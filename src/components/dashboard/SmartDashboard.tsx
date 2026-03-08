"use client";

import useSWR from "swr";
import {
  Gauge, Package, TrendingUp, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus,
  Loader2, ExternalLink, Users,
} from "lucide-react";
import Link from "next/link";

interface MechanicStats {
  id: string;
  name: string;
  hoursWorked: number;
  laborRevenue: number;
  effectiveRate: number;
}

interface SmartDashboardStats {
  efficiency: {
    totalBilledHours: number;
    totalLaborRevenue: number;
    effectiveRate: number;
    targetRate: number;
    mechanics: MechanicStats[];
  };
  inventory: {
    totalValue: number;
    agedValue: number;
    agedPartCount: number;
    slowestParts: {
      id: string;
      name: string;
      partNumber: string;
      value: number;
      daysSinceLastMovement: number;
    }[];
    lowStockCount: number;
  };
  monthlyResult: {
    revenue: number;
    prevMonthRevenue: number;
    revenueTrend: "up" | "down" | "flat";
    grossMarginPct: number;
    partsCost: number;
  };
}

function fmt(n: number): string {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtKr(n: number): string {
  return `${fmt(n)} kr`;
}

function fmtDecimal(n: number): string {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function rateColor(rate: number, target: number): string {
  if (rate >= target) return "text-green-400";
  if (rate >= target * 0.9) return "text-amber-400";
  return "text-red-400";
}

function rateBg(rate: number, target: number): string {
  if (rate >= target) return "bg-green-900/30 text-green-300";
  if (rate >= target * 0.9) return "bg-amber-900/30 text-amber-300";
  return "bg-red-900/30 text-red-300";
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

export function SmartDashboard() {
  const { data, isLoading } = useSWR<SmartDashboardStats>(
    "/api/dashboard/stats",
    { refreshInterval: 60_000 },
  );

  if (isLoading) {
    return (
      <div className="surface p-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-workshop-muted" />
        <span className="ml-2 text-sm text-workshop-muted">Laddar statistik...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <EfficiencySection data={data.efficiency} />
      <InventorySection data={data.inventory} />
      <MonthlyResultSection data={data.monthlyResult} />
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 1: Verkstadens effektivitet
// ──────────────────────────────────────────────

function EfficiencySection({ data }: { data: SmartDashboardStats["efficiency"] }) {
  const hasData = data.totalBilledHours > 0;

  return (
    <div className="surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-workshop-text flex items-center gap-2">
          <Gauge className="h-4 w-4 text-workshop-accent" />
          Verkstadens effektivitet
        </h2>
        <span className="text-xs text-workshop-muted">Denna m&aring;nad</span>
      </div>

      {hasData ? (
        <>
          {/* Hero rate */}
          <div className="text-center py-3">
            <p className="text-4xl font-bold font-mono text-workshop-text">
              {fmt(data.effectiveRate)}{" "}
              <span className="text-lg text-workshop-muted">kr/tim</span>
            </p>
            <p className="text-sm text-workshop-muted mt-1">
              Effektiv timpeng &mdash; {fmtDecimal(data.totalBilledHours)} tim fakturerade
            </p>
            <span
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full mt-2 ${rateBg(
                data.effectiveRate,
                data.targetRate,
              )}`}
            >
              M&aring;l: {fmt(data.targetRate)} kr/tim
            </span>
          </div>

          {/* Per mechanic */}
          {data.mechanics.length > 0 && (
            <div>
              <p className="text-xs text-workshop-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Per mekaniker
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.mechanics.map((m) => (
                  <div key={m.id} className="bg-workshop-elevated rounded-lg p-3">
                    <p className="text-sm font-medium text-workshop-text truncate">
                      {m.name}
                    </p>
                    <div className="flex justify-between mt-2">
                      <div>
                        <p className="text-xs text-workshop-muted">Timmar</p>
                        <p className="text-sm font-mono text-workshop-text">
                          {fmtDecimal(m.hoursWorked)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-workshop-muted">kr/tim</p>
                        <p
                          className={`text-sm font-mono font-bold ${rateColor(
                            m.effectiveRate,
                            data.targetRate,
                          )}`}
                        >
                          {m.hoursWorked > 0 ? fmt(m.effectiveRate) : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-workshop-muted text-center py-4">
          Inga avslutade uppgifter denna m&aring;nad
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 2: Lagervärde & åldring
// ──────────────────────────────────────────────

function InventorySection({ data }: { data: SmartDashboardStats["inventory"] }) {
  return (
    <div className="surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-workshop-text flex items-center gap-2">
          <Package className="h-4 w-4 text-workshop-accent" />
          Lagerv&auml;rde &amp; &aring;ldring
        </h2>
        <Link
          href="/lager"
          className="text-sm text-workshop-accent hover:underline flex items-center gap-1"
        >
          Visa lager <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Two stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-workshop-elevated rounded-lg p-3">
          <p className="text-xs text-workshop-muted">Totalt lagerv&auml;rde</p>
          <p className="text-xl font-bold font-mono text-workshop-text mt-1">
            {fmtKr(data.totalValue)}
          </p>
        </div>
        <div className="bg-workshop-elevated rounded-lg p-3">
          <p className="text-xs text-workshop-muted">L&aring;glager-varningar</p>
          <p
            className={`text-xl font-bold font-mono mt-1 ${
              data.lowStockCount > 0 ? "text-amber-400" : "text-green-400"
            }`}
          >
            {data.lowStockCount}
          </p>
        </div>
      </div>

      {/* Aged inventory warning */}
      {data.agedValue > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium text-sm">
              Du har {fmtKr(data.agedValue)} bundet i {data.agedPartCount} delar som legat mer
              &auml;n 3 m&aring;nader
            </p>
            <p className="text-amber-400/70 text-xs mt-1">
              &Ouml;verv&auml;g att s&auml;lja ut eller skriva av dessa delar f&ouml;r att
              frig&ouml;ra kapital.
            </p>
          </div>
        </div>
      )}

      {/* Slowest parts table */}
      {data.slowestParts.length > 0 && (
        <div>
          <p className="text-xs text-workshop-muted uppercase tracking-wider mb-2">
            Tr&ouml;gast r&ouml;rliga delar
          </p>
          <div className="space-y-1.5">
            {data.slowestParts.map((part) => (
              <div
                key={part.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-workshop-elevated/50"
              >
                <div className="min-w-0">
                  <p className="text-sm text-workshop-text truncate">{part.name}</p>
                  <p className="text-xs text-workshop-muted">{part.partNumber}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-mono text-workshop-text">{fmtKr(part.value)}</p>
                  <p className="text-xs text-red-400">
                    {part.daysSinceLastMovement >= 9999
                      ? "Aldrig r\u00f6rd"
                      : `${part.daysSinceLastMovement} dagar inaktiv`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 3: Månadsresultat
// ──────────────────────────────────────────────

function MonthlyResultSection({ data }: { data: SmartDashboardStats["monthlyResult"] }) {
  const TrendIcon =
    data.revenueTrend === "up"
      ? ArrowUpRight
      : data.revenueTrend === "down"
        ? ArrowDownRight
        : Minus;

  const trendColor =
    data.revenueTrend === "up"
      ? "text-green-400"
      : data.revenueTrend === "down"
        ? "text-red-400"
        : "text-workshop-muted";

  return (
    <div className="surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-workshop-text flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-workshop-accent" />
          M&aring;nadsresultat
        </h2>
        <Link
          href="/ekonomi"
          className="text-sm text-workshop-accent hover:underline flex items-center gap-1"
        >
          Detaljer <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Revenue */}
        <div>
          <p className="text-xs text-workshop-muted">Oms&auml;ttning</p>
          <p className="text-xl font-bold font-mono text-workshop-text">{fmtKr(data.revenue)}</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendIcon className={`h-3 w-3 ${trendColor}`} />
            <span className={`text-xs ${trendColor}`}>vs f&ouml;reg. m&aring;nad</span>
          </div>
        </div>

        {/* Gross margin */}
        <div>
          <p className="text-xs text-workshop-muted">Bruttomarginal</p>
          <p className="text-xl font-bold font-mono text-workshop-text">
            {data.grossMarginPct.toFixed(1)}%
          </p>
        </div>

        {/* Parts cost */}
        <div>
          <p className="text-xs text-workshop-muted">Delkostnad</p>
          <p className="text-xl font-bold font-mono text-workshop-text">
            {fmtKr(data.partsCost)}
          </p>
        </div>
      </div>
    </div>
  );
}

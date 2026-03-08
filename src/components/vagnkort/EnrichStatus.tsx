"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, CheckCircle2, KeyRound, Wifi, WifiOff, Shield } from "lucide-react";
import { useEnrichment } from "@/components/layout/EnrichmentProvider";

type CarInfoStatus = {
  serviceRunning: boolean;
  blocked: boolean;
  hasCookies: boolean;
  cookieAgeHours: number | null;
  sources?: { biluppgifter: string; carinfo: string };
};

type BiluppgifterStatus = {
  hasCookies: boolean;
  cookieAgeHours: number | null;
  cfClearanceValid: boolean;
  cfClearanceExpiresAt: string | null;
};

/**
 * EnrichStatus — shown on the Vagnkort page.
 * Connects to the global EnrichmentProvider context.
 * Shows queue size when idle, current vehicle details when running.
 * Includes car.info login status and login button.
 */
export function EnrichStatus() {
  const { state, startEnrich } = useEnrichment();
  const [queueSize, setQueueSize] = useState<number | null>(null);
  const [carInfo, setCarInfo] = useState<CarInfoStatus | null>(null);
  const [biluppgifter, setBiluppgifter] = useState<BiluppgifterStatus | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");

  // Check queue size + car.info status + biluppgifter status on mount
  useEffect(() => {
    (async () => {
      try {
        const [enrichRes, ciRes, scraperRes] = await Promise.all([
          fetch("/api/vagnkort/enrich"),
          fetch("/api/vagnkort/carinfo-login"),
          fetch("/api/scraper/status"),
        ]);
        if (enrichRes.ok) {
          const data = await enrichRes.json();
          setQueueSize(data.total);
        }
        if (ciRes.ok) {
          const data = await ciRes.json();
          setCarInfo(data);
        }
        if (scraperRes.ok) {
          const data = await scraperRes.json();
          if (data.biluppgifter) setBiluppgifter(data.biluppgifter);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  async function handleCarInfoLogin() {
    setLoginLoading(true);
    setLoginMsg("");
    try {
      const res = await fetch("/api/vagnkort/carinfo-login", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setLoginMsg("Webbläsare öppnad — logga in på car.info manuellt!");
        // Poll status every 10s to detect successful login
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch("/api/vagnkort/carinfo-login");
            if (statusRes.ok) {
              const status = await statusRes.json();
              setCarInfo(status);
              if (status.hasCookies && !status.blocked) {
                setLoginMsg("Inloggad på car.info!");
                setLoginLoading(false);
                clearInterval(poll);
              }
            }
          } catch {}
        }, 10_000);
        // Stop polling after 5 min
        setTimeout(() => {
          clearInterval(poll);
          setLoginLoading(false);
        }, 300_000);
      } else {
        setLoginMsg(data.error ?? "Kunde inte starta inloggning");
        setLoginLoading(false);
      }
    } catch {
      setLoginMsg("Nätverksfel — kör lookup-tjänsten?");
      setLoginLoading(false);
    }
  }

  const {
    running, done, total, completed, enriched, errors,
    currentRegNr, currentBrand, currentModel, recentEvents,
  } = state;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Running — show detailed progress with vehicle info
  if (running) {
    return (
      <div className="space-y-3">
        <div className="surface rounded-lg border border-workshop-border p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-workshop-accent animate-spin flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-workshop-text">
                Berikar fordonsdata...
              </p>
              <div className="flex items-center gap-2 mt-1">
                {currentRegNr && (
                  <>
                    <span className="reg-plate text-[10px]">{currentRegNr}</span>
                    {currentBrand && currentBrand !== "Okänt" && (
                      <span className="text-xs text-workshop-muted">
                        {currentBrand} {currentModel !== "Okänt" ? currentModel : ""}
                      </span>
                    )}
                  </>
                )}
                <span className="text-xs text-workshop-muted ml-auto">
                  {completed + 1}/{total} ({pct}%)
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-1.5 bg-workshop-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-workshop-accent rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-workshop-muted">
                {enriched > 0 && `${enriched} berikade`}
                {errors > 0 && ` · ${errors} fel`}
              </span>
              <span className="text-[10px] text-workshop-muted">
                Se detaljer i statusfältet ↓
              </span>
            </div>
          </div>

          {/* Last 3 enriched vehicles */}
          {recentEvents.filter((e) => e.type === "enriched").length > 0 && (
            <div className="mt-3 space-y-1">
              {recentEvents
                .filter((e) => e.type === "enriched")
                .slice(0, 3)
                .map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-green-900/10 border border-green-900/20"
                  >
                    <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />
                    <span className="reg-plate text-[9px]">{e.regNr}</span>
                    <span className="text-green-400 truncate">
                      {e.brand} {e.model}
                      {e.year ? ` ${e.year}` : ""}
                      {e.engineCode ? ` · ${e.engineCode}` : ""}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
        <CarInfoBar carInfo={carInfo} loginLoading={loginLoading} loginMsg={loginMsg} onLogin={handleCarInfoLogin} />
        <BiluppgifterBar status={biluppgifter} />
      </div>
    );
  }

  // Done state
  if (done) {
    return (
      <div className="space-y-3">
        <div className="surface rounded-lg border border-green-800/30 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <p className="text-sm font-medium text-green-400">
              Berikning klar — {enriched} fordon uppdaterade
              {errors > 0 && <span className="text-red-400 ml-1">({errors} fel)</span>}
            </p>
          </div>
        </div>
        <CarInfoBar carInfo={carInfo} loginLoading={loginLoading} loginMsg={loginMsg} onLogin={handleCarInfoLogin} />
        <BiluppgifterBar status={biluppgifter} />
      </div>
    );
  }

  // Idle — show queue size with start button + car.info status + biluppgifter status
  return (
    <div className="space-y-3">
      {(queueSize !== null && queueSize > 0) && (
        <div className="surface rounded-lg border border-workshop-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-medium text-workshop-text">
                {queueSize} fordon saknar teknisk data
              </h3>
            </div>
            <button
              onClick={() => startEnrich()}
              className="flex items-center gap-2 px-4 py-2 bg-amber-700/30 hover:bg-amber-700/50 border border-amber-700 text-amber-300 rounded-md text-xs font-medium transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Berika automatiskt
            </button>
          </div>
        </div>
      )}
      <CarInfoBar carInfo={carInfo} loginLoading={loginLoading} loginMsg={loginMsg} onLogin={handleCarInfoLogin} />
      <BiluppgifterBar status={biluppgifter} />
    </div>
  );
}

/* ── car.info status bar ── */
function CarInfoBar({
  carInfo,
  loginLoading,
  loginMsg,
  onLogin,
}: {
  carInfo: CarInfoStatus | null;
  loginLoading: boolean;
  loginMsg: string;
  onLogin: () => void;
}) {
  if (!carInfo) return null;

  const isOk = carInfo.serviceRunning && !carInfo.blocked && carInfo.hasCookies;
  const isBlocked = carInfo.blocked;
  const noCookies = !carInfo.hasCookies;
  const serviceDown = !carInfo.serviceRunning;

  return (
    <div className={`surface rounded-lg border p-3 ${
      isOk ? "border-green-800/30" : isBlocked ? "border-red-800/30" : "border-workshop-border"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {serviceDown ? (
            <WifiOff className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
          ) : isOk ? (
            <Wifi className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className={`text-xs font-medium ${
              serviceDown ? "text-red-400" : isOk ? "text-green-400" : isBlocked ? "text-red-400" : "text-amber-400"
            }`}>
              car.info: {serviceDown
                ? "Tjänsten körs inte"
                : isOk
                  ? `Ansluten${carInfo.cookieAgeHours !== null ? ` (${carInfo.cookieAgeHours < 1 ? "nyss" : `${carInfo.cookieAgeHours}h sedan`})` : ""}`
                  : isBlocked
                    ? "Blockerad (429)"
                    : noCookies
                      ? "Ej inloggad"
                      : "Okänt"
              }
            </p>
            {loginMsg && (
              <p className="text-[10px] text-workshop-muted mt-0.5">{loginMsg}</p>
            )}
          </div>
        </div>
        {!serviceDown && (!isOk || isBlocked) && (
          <button
            onClick={onLogin}
            disabled={loginLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800 text-blue-300 rounded-md text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {loginLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <KeyRound className="h-3 w-3" />
            )}
            {loginLoading ? "Väntar..." : "Logga in car.info"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── biluppgifter.se status bar ── */
function BiluppgifterBar({ status }: { status: BiluppgifterStatus | null }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [localStatus, setLocalStatus] = useState(status);

  // Sync prop → local
  useEffect(() => { setLocalStatus(status); }, [status]);

  if (!localStatus) return null;

  const isOk = localStatus.hasCookies && localStatus.cfClearanceValid;
  const expired = localStatus.hasCookies && !localStatus.cfClearanceValid;

  const ageText = localStatus.cookieAgeHours !== null
    ? localStatus.cookieAgeHours < 1 ? "nyss" : `${localStatus.cookieAgeHours}h sedan`
    : null;

  async function handleLogin() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/vagnkort/biluppgifter-login", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMsg("Webbläsare öppnad på MagicNUC — logga in med BankID!");
        // Poll status every 10s
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch("/api/vagnkort/biluppgifter-login");
            if (statusRes.ok) {
              const s = await statusRes.json();
              setLocalStatus(s);
              if (s.hasCookies && s.cfClearanceValid) {
                setMsg("Inloggad på biluppgifter.se!");
                setLoading(false);
                clearInterval(poll);
              }
            }
          } catch {}
        }, 10_000);
        setTimeout(() => { clearInterval(poll); setLoading(false); }, 300_000);
      } else {
        setMsg(data.error ?? "Kunde inte starta inloggning");
        setLoading(false);
      }
    } catch {
      setMsg("Nätverksfel — kör lookup-tjänsten?");
      setLoading(false);
    }
  }

  return (
    <div className={`surface rounded-lg border p-3 ${
      isOk ? "border-green-800/30" : "border-amber-800/30"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isOk ? (
            <Shield className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
          ) : (
            <Shield className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className={`text-xs font-medium ${isOk ? "text-green-400" : "text-amber-400"}`}>
              biluppgifter.se: {isOk
                ? `Ansluten${ageText ? ` (${ageText})` : ""}`
                : expired
                  ? "Cloudflare-session utgången"
                  : "Ej inloggad"
              }
            </p>
            {msg && (
              <p className="text-[10px] text-workshop-muted mt-0.5">{msg}</p>
            )}
          </div>
        </div>
        {!isOk && (
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800 text-blue-300 rounded-md text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <KeyRound className="h-3 w-3" />
            )}
            {loading ? "Väntar på BankID..." : "Logga in (BankID)"}
          </button>
        )}
      </div>
    </div>
  );
}

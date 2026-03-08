import { Wrench, Car, FileText, Package, Clock, AlertTriangle, Database } from "lucide-react";
import { db } from "@/lib/db";
import { workOrders, appointments, invoices } from "@/lib/db/schemas";
import { eq, count, lte, and, ne, gte, sql } from "drizzle-orm";
import { addDays, startOfDay } from "date-fns";
import Link from "next/link";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { SmartDashboard } from "@/components/dashboard/SmartDashboard";

export const metadata = { title: "Översikt" };
export const dynamic = "force-dynamic";

interface DashboardStats {
  ongoing: number;
  queued: number;
  waitingForParts: number;
  readyForPickup: number;
  todayAppointments: any[];
  overdueInvoices: number;
  dbConnected: boolean;
}

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Consolidated: 1 query for all 4 work order status counts (was 4 separate queries)
    const [statusCounts, todayAppointments, overdueInvoices] = await Promise.all([
      db.select({
        ongoing:         sql<number>`count(*) filter (where ${workOrders.status} = 'ongoing')`,
        queued:          sql<number>`count(*) filter (where ${workOrders.status} = 'queued')`,
        waitingForParts: sql<number>`count(*) filter (where ${workOrders.status} = 'waiting_for_parts')`,
        readyForPickup:  sql<number>`count(*) filter (where ${workOrders.status} = 'ready_for_pickup')`,
      }).from(workOrders),
      db.select().from(appointments)
        .where(
          and(
            ne(appointments.status, "cancelled"),
            gte(appointments.scheduledStart, startOfDay(new Date())),
            lte(appointments.scheduledStart, addDays(startOfDay(new Date()), 1)),
          ),
        )
        .orderBy(appointments.scheduledStart)
        .limit(10),
      db.select({ count: count() }).from(invoices).where(eq(invoices.status, "overdue")),
    ]);

    return {
      ongoing:          Number(statusCounts[0]?.ongoing ?? 0),
      queued:           Number(statusCounts[0]?.queued ?? 0),
      waitingForParts:  Number(statusCounts[0]?.waitingForParts ?? 0),
      readyForPickup:   Number(statusCounts[0]?.readyForPickup ?? 0),
      todayAppointments,
      overdueInvoices:  overdueInvoices[0].count,
      dbConnected:      true,
    };
  } catch (err) {
    console.error("[dashboard] DB query failed:", err);
    return {
      ongoing: 0,
      queued: 0,
      waitingForParts: 0,
      readyForPickup: 0,
      todayAppointments: [],
      overdueInvoices: 0,
      dbConnected: false,
    };
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-workshop-text">Översikt</h1>
        <p className="text-workshop-muted text-sm">Verkstadens status just nu</p>
      </div>

      {/* DB Connection Warning */}
      {!stats.dbConnected && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-4 flex items-start gap-3">
          <Database className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium text-sm">Databasen ej tillgänglig</p>
            <p className="text-amber-400/70 text-xs mt-1">
              Kör <code className="bg-amber-950/50 px-1.5 py-0.5 rounded font-mono">supabase start</code> och sedan{" "}
              <code className="bg-amber-950/50 px-1.5 py-0.5 rounded font-mono">supabase db reset</code> för att starta databasen.
              Appen fungerar i demo-läge tills dess.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Pågående"
          value={stats.ongoing}
          icon={Wrench}
          color="text-amber-400"
          href="/arbetsorder"
        />
        <KpiCard
          label="I kö"
          value={stats.queued}
          icon={Clock}
          color="text-zinc-400"
          href="/arbetsorder"
        />
        <KpiCard
          label="Väntar på delar"
          value={stats.waitingForParts}
          icon={Package}
          color="text-blue-400"
          href="/arbetsorder"
        />
        <KpiCard
          label="Klar för hämtning"
          value={stats.readyForPickup}
          icon={Car}
          color="text-green-400"
          href="/arbetsorder"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Appointments */}
        <div className="surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-workshop-text">Dagens bokningar</h2>
            <Link href="/kalender/dag" className="text-sm text-workshop-accent hover:underline">
              Visa dagvy
            </Link>
          </div>

          {stats.todayAppointments.length === 0 ? (
            <p className="text-workshop-muted text-sm py-4 text-center">
              Inga bokningar idag
            </p>
          ) : (
            <div className="space-y-2">
              {stats.todayAppointments.map((appt: any) => (
                <div
                  key={appt.id}
                  className="flex items-center gap-3 p-3 bg-workshop-elevated rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-workshop-text truncate">
                      {appt.serviceDescription ?? "Bokning"}
                    </p>
                    <p className="text-xs text-workshop-muted">
                      {new Date(appt.scheduledStart).toLocaleTimeString("sv-SE", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {" – "}
                      {new Date(appt.scheduledEnd).toLocaleTimeString("sv-SE", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      appt.status === "confirmed"
                        ? "bg-green-900/50 text-green-300"
                        : "bg-yellow-900/50 text-yellow-300"
                    }`}
                  >
                    {appt.status === "confirmed" ? "Bekräftad" : "Väntande"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <ActivityFeed />
      </div>

      {/* Smart Dashboard — efficiency, inventory aging, monthly result */}
      <SmartDashboard />

      {/* Overdue invoices */}
      {stats.overdueInvoices > 0 && (
        <div className="surface p-4 border-l-4 border-red-600">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-300 font-medium">
              {stats.overdueInvoices} förfallna fakturor
            </p>
            <Link href="/faktura" className="text-sm text-workshop-accent hover:underline ml-auto">
              Visa fakturor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, color, href,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href: string;
}) {
  return (
    <Link href={href} className="surface p-4 flex items-center gap-3 hover:bg-workshop-elevated transition-colors">
      <div className={`p-2 rounded-lg bg-workshop-elevated ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-workshop-text">{value}</p>
        <p className="text-xs text-workshop-muted">{label}</p>
      </div>
    </Link>
  );
}

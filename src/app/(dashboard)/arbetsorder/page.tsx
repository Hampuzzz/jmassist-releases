import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { workOrders, vehicles, customers } from "@/lib/db/schemas";
import { eq, desc, sql } from "drizzle-orm";
import { WORK_ORDER_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Arbetsorder" };
export const dynamic = "force-dynamic";

const KANBAN_COLUMNS = [
  "queued",
  "diagnosing",
  "ongoing",
  "ordering_parts",
  "waiting_for_parts",
  "ready_for_pickup",
] as const;

export default async function ArbetsorderPage() {
  let orders: any[] = [];
  try {
    orders = await db
      .select({
        id:               workOrders.id,
        orderNumber:      workOrders.orderNumber,
        status:           workOrders.status,
        receivedAt:       workOrders.receivedAt,
        promisedAt:       workOrders.promisedAt,
        customerComplaint: workOrders.customerComplaint,
        vehicleRegNr:     vehicles.regNr,
        vehicleBrand:     vehicles.brand,
        vehicleModel:     vehicles.model,
        customerName:     customers.firstName,
        customerLast:     customers.lastName,
        customerCo:       customers.companyName,
      })
      .from(workOrders)
      .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
      .innerJoin(customers, eq(workOrders.customerId, customers.id))
      .where(
        sql`${workOrders.status} NOT IN ('finished', 'cancelled')`
      )
      .orderBy(desc(workOrders.receivedAt));
  } catch (err) {
    console.error("[arbetsorder] DB query failed:", err);
  }

  const byStatus = Object.fromEntries(
    KANBAN_COLUMNS.map((s) => [s, orders.filter((o) => o.status === s)]),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Arbetsorder</h1>
          <p className="text-workshop-muted text-sm">{orders.length} aktiva ordrar</p>
        </div>
        <Link
          href="/arbetsorder/ny"
          className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent/80 text-white rounded-md transition-colors font-medium text-sm"
        >
          <Plus className="h-4 w-4" />
          Ny order
        </Link>
      </div>

      {/* Kanban board - scrollable horizontally */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {KANBAN_COLUMNS.map((status) => {
          const config = WORK_ORDER_STATUSES[status];
          const columnOrders = byStatus[status] ?? [];

          return (
            <div key={status} className="surface p-3 min-w-[220px] md:min-w-0 md:flex-1 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className={`status-badge ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-xs text-workshop-muted font-mono">
                  {columnOrders.length}
                </span>
              </div>

              <div className="space-y-2">
                {columnOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/arbetsorder/${order.id}`}
                    className="block bg-workshop-elevated p-3 rounded-md hover:bg-zinc-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-workshop-muted font-mono">
                        {order.orderNumber}
                      </span>
                      <span className="reg-plate text-[10px] py-0 px-1">
                        {order.vehicleRegNr}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-workshop-text">
                      {order.vehicleBrand} {order.vehicleModel}
                    </p>
                    <p className="text-xs text-workshop-muted truncate">
                      {order.customerCo ?? `${order.customerName ?? ""} ${order.customerLast ?? ""}`}
                    </p>
                    {order.customerComplaint && (
                      <p className="text-xs text-workshop-muted/70 truncate mt-1 italic">
                        {order.customerComplaint}
                      </p>
                    )}
                    {order.promisedAt && (
                      <p className="text-xs text-amber-400 mt-1">
                        Lovas: {formatDate(order.promisedAt)}
                      </p>
                    )}
                  </Link>
                ))}

                {columnOrders.length === 0 && (
                  <p className="text-xs text-workshop-muted text-center py-4">
                    Inga ordrar
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

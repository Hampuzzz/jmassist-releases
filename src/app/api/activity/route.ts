import { db } from "@/lib/db";
import { workOrders, vehicles, customers, invoices } from "@/lib/db/schemas";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface ActivityItem {
  id: string;
  type: "work_order" | "vehicle" | "customer" | "invoice";
  action: string;
  title: string;
  subtitle?: string;
  timestamp: string;
}

/**
 * GET /api/activity
 * Returns last 20 system activity items (recent creates/updates).
 * Uses updatedAt vs createdAt delta to determine if it's a create or update.
 */
export async function GET() {
  try {
    // Fetch recent items from each table, sorted by updatedAt
    const [recentWO, recentVehicles, recentCustomers, recentInvoices] =
      await Promise.all([
        db
          .select({
            id: workOrders.id,
            orderNumber: workOrders.orderNumber,
            status: workOrders.status,
            complaint: workOrders.customerComplaint,
            createdAt: workOrders.createdAt,
            updatedAt: workOrders.updatedAt,
          })
          .from(workOrders)
          .orderBy(desc(workOrders.updatedAt))
          .limit(10),
        db
          .select({
            id: vehicles.id,
            regNr: vehicles.regNr,
            brand: vehicles.brand,
            model: vehicles.model,
            createdAt: vehicles.createdAt,
            updatedAt: vehicles.updatedAt,
            externalFetchedAt: vehicles.externalFetchedAt,
          })
          .from(vehicles)
          .orderBy(desc(vehicles.updatedAt))
          .limit(10),
        db
          .select({
            id: customers.id,
            firstName: customers.firstName,
            lastName: customers.lastName,
            companyName: customers.companyName,
            isCompany: customers.isCompany,
            createdAt: customers.createdAt,
            updatedAt: customers.updatedAt,
          })
          .from(customers)
          .orderBy(desc(customers.updatedAt))
          .limit(10),
        db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            status: invoices.status,
            type: invoices.type,
            createdAt: invoices.createdAt,
            updatedAt: invoices.updatedAt,
          })
          .from(invoices)
          .orderBy(desc(invoices.updatedAt))
          .limit(10),
      ]);

    const items: ActivityItem[] = [];

    // Work orders
    for (const wo of recentWO) {
      const isNew =
        Math.abs(
          new Date(wo.updatedAt).getTime() - new Date(wo.createdAt).getTime(),
        ) < 5000;
      items.push({
        id: `wo-${wo.id}`,
        type: "work_order",
        action: isNew ? "created" : "updated",
        title: isNew
          ? `Ny arbetsorder ${wo.orderNumber}`
          : `Arbetsorder ${wo.orderNumber} uppdaterad`,
        subtitle: wo.complaint
          ? wo.complaint.substring(0, 60) +
            (wo.complaint.length > 60 ? "..." : "")
          : statusLabel(wo.status),
        timestamp: wo.updatedAt.toISOString(),
      });
    }

    // Vehicles
    for (const v of recentVehicles) {
      const isNew =
        Math.abs(
          new Date(v.updatedAt).getTime() - new Date(v.createdAt).getTime(),
        ) < 5000;
      const isEnriched =
        !isNew &&
        v.externalFetchedAt &&
        Math.abs(
          new Date(v.updatedAt).getTime() -
            new Date(v.externalFetchedAt).getTime(),
        ) < 10000;

      items.push({
        id: `v-${v.id}`,
        type: "vehicle",
        action: isEnriched ? "enriched" : isNew ? "created" : "updated",
        title: isEnriched
          ? `${v.brand} ${v.regNr} berikad med teknisk data`
          : isNew
            ? `Nytt fordon: ${v.regNr}`
            : `${v.regNr} uppdaterad`,
        subtitle: `${v.brand} ${v.model}`,
        timestamp: v.updatedAt.toISOString(),
      });
    }

    // Customers
    for (const c of recentCustomers) {
      const isNew =
        Math.abs(
          new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime(),
        ) < 5000;
      const name = c.isCompany
        ? c.companyName
        : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
      items.push({
        id: `c-${c.id}`,
        type: "customer",
        action: isNew ? "created" : "updated",
        title: isNew ? `Ny kund: ${name}` : `Kund ${name} uppdaterad`,
        timestamp: c.updatedAt.toISOString(),
      });
    }

    // Invoices
    for (const inv of recentInvoices) {
      const isNew =
        Math.abs(
          new Date(inv.updatedAt).getTime() -
            new Date(inv.createdAt).getTime(),
        ) < 5000;
      items.push({
        id: `i-${inv.id}`,
        type: "invoice",
        action: isNew ? "created" : "updated",
        title: isNew
          ? `Ny faktura ${inv.invoiceNumber}`
          : `Faktura ${inv.invoiceNumber} uppdaterad`,
        subtitle: statusLabel(inv.status),
        timestamp: inv.updatedAt.toISOString(),
      });
    }

    // Sort all by timestamp descending, take 20
    items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return Response.json(items.slice(0, 20));
  } catch (err) {
    console.error("[activity] Failed:", err);
    return Response.json([]);
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: "I kö",
    ongoing: "Pågående",
    waiting_for_parts: "Väntar på delar",
    ready_for_pickup: "Klar för hämtning",
    completed: "Klar",
    cancelled: "Avbruten",
    draft: "Utkast",
    sent: "Skickad",
    paid: "Betald",
    overdue: "Förfallen",
    credited: "Krediterad",
  };
  return map[status] ?? status;
}

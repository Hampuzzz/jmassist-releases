import { db } from "@/lib/db";
import { customers, vehicles, workOrders } from "@/lib/db/schemas";
import { or, ilike, sql, desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface SearchResult {
  id: string;
  type: "customer" | "vehicle" | "work_order";
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
  badgeColor?: string;
}

/**
 * GET /api/search?q=<query>
 * Universal search across customers, vehicles, and work orders.
 * Searches by name, regNr, phone, order number.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return Response.json([]);
  }

  const pattern = `%${q}%`;
  const results: SearchResult[] = [];

  try {
    // Run all three searches in parallel
    const [matchedCustomers, matchedVehicles, matchedWorkOrders] =
      await Promise.all([
        // Customers: name, company, phone, email
        db
          .select({
            id: customers.id,
            firstName: customers.firstName,
            lastName: customers.lastName,
            companyName: customers.companyName,
            isCompany: customers.isCompany,
            phone: customers.phone,
            email: customers.email,
          })
          .from(customers)
          .where(
            or(
              ilike(customers.firstName, pattern),
              ilike(customers.lastName, pattern),
              ilike(customers.companyName, pattern),
              ilike(customers.phone, pattern),
              ilike(customers.email, pattern),
            ),
          )
          .limit(8),

        // Vehicles: regNr, brand, model, vin
        db
          .select({
            id: vehicles.id,
            regNr: vehicles.regNr,
            brand: vehicles.brand,
            model: vehicles.model,
            modelYear: vehicles.modelYear,
            vin: vehicles.vin,
          })
          .from(vehicles)
          .where(
            or(
              ilike(vehicles.regNr, pattern),
              ilike(vehicles.brand, pattern),
              ilike(vehicles.model, pattern),
              ilike(vehicles.vin, pattern),
            ),
          )
          .limit(8),

        // Work orders: orderNumber, customerComplaint
        db
          .select({
            id: workOrders.id,
            orderNumber: workOrders.orderNumber,
            status: workOrders.status,
            complaint: workOrders.customerComplaint,
          })
          .from(workOrders)
          .where(
            or(
              ilike(workOrders.orderNumber, pattern),
              ilike(workOrders.customerComplaint, pattern),
            ),
          )
          .orderBy(desc(workOrders.createdAt))
          .limit(8),
      ]);

    // Map customers
    for (const c of matchedCustomers) {
      const name = c.isCompany
        ? c.companyName
        : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
      results.push({
        id: c.id,
        type: "customer",
        title: name || "Namnlös kund",
        subtitle: [c.phone, c.email].filter(Boolean).join(" · "),
        href: `/kunder/${c.id}`,
        badge: "Kund",
        badgeColor: "bg-green-900/40 text-green-300 border-green-800",
      });
    }

    // Map vehicles
    for (const v of matchedVehicles) {
      results.push({
        id: v.id,
        type: "vehicle",
        title: v.regNr,
        subtitle: `${v.brand} ${v.model}${v.modelYear ? ` ${v.modelYear}` : ""}`,
        href: `/vagnkort/${v.id}`,
        badge: "Fordon",
        badgeColor: "bg-blue-900/40 text-blue-300 border-blue-800",
      });
    }

    // Map work orders
    const STATUS_MAP: Record<string, string> = {
      queued: "I kö",
      ongoing: "Pågående",
      waiting_for_parts: "Väntar på delar",
      ready_for_pickup: "Klar för hämtning",
      completed: "Klar",
      cancelled: "Avbruten",
    };

    for (const wo of matchedWorkOrders) {
      results.push({
        id: wo.id,
        type: "work_order",
        title: `AO ${wo.orderNumber}`,
        subtitle: wo.complaint
          ? wo.complaint.substring(0, 50)
          : STATUS_MAP[wo.status] ?? wo.status,
        href: `/arbetsorder/${wo.id}`,
        badge: STATUS_MAP[wo.status] ?? wo.status,
        badgeColor: "bg-amber-900/40 text-amber-300 border-amber-800",
      });
    }

    return Response.json(results);
  } catch (err) {
    console.error("[search] Failed:", err);
    return Response.json([]);
  }
}

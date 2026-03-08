import { db } from "@/lib/db";
import { appointments, resources, vehicles, customers, workOrders } from "@/lib/db/schemas";
import { and, gte, lte, ne, eq, asc, sql } from "drizzle-orm";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import DayCalendar from "@/components/kalender/DayCalendar";

export const metadata = { title: "Dagvy - Kalender" };
export const dynamic = "force-dynamic";

export default async function DayViewPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const targetDate = searchParams.date ? new Date(searchParams.date) : new Date();
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);
  const isToday = format(targetDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  const prevDate = format(addDays(targetDate, -1), "yyyy-MM-dd");
  const nextDate = format(addDays(targetDate, 1), "yyyy-MM-dd");

  let appts: any[] = [];
  let activeOrders: any[] = [];
  let resourceList: any[] = [];

  try {
    [appts, activeOrders, resourceList] = await Promise.all([
      db
        .select({
          id:                 appointments.id,
          scheduledStart:     appointments.scheduledStart,
          scheduledEnd:       appointments.scheduledEnd,
          status:             appointments.status,
          serviceDescription: appointments.serviceDescription,
          customerNotes:      appointments.customerNotes,
          resourceId:         appointments.resourceId,
          vehicleRegNr:       vehicles.regNr,
          vehicleBrand:       vehicles.brand,
          vehicleModel:       vehicles.model,
          customerFirst:      customers.firstName,
          customerLast:       customers.lastName,
          customerCo:         customers.companyName,
          customerPhone:      customers.phone,
          resourceName:       resources.name,
        })
        .from(appointments)
        .innerJoin(vehicles, eq(appointments.vehicleId, vehicles.id))
        .innerJoin(customers, eq(appointments.customerId, customers.id))
        .leftJoin(resources, eq(appointments.resourceId, resources.id))
        .where(
          and(
            ne(appointments.status, "cancelled"),
            gte(appointments.scheduledStart, dayStart),
            lte(appointments.scheduledStart, dayEnd),
          ),
        )
        .orderBy(asc(appointments.scheduledStart)),

      db
        .select({
          id:                workOrders.id,
          orderNumber:       workOrders.orderNumber,
          status:            workOrders.status,
          vehicleRegNr:      vehicles.regNr,
          vehicleBrand:      vehicles.brand,
          vehicleModel:      vehicles.model,
          customerFirst:     customers.firstName,
          customerLast:      customers.lastName,
          customerCo:        customers.companyName,
          customerComplaint: workOrders.customerComplaint,
        })
        .from(workOrders)
        .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
        .innerJoin(customers, eq(workOrders.customerId, customers.id))
        .where(
          sql`${workOrders.status} IN ('queued', 'diagnosing', 'ongoing', 'ordering_parts', 'waiting_for_parts', 'ready_for_pickup')`
        )
        .orderBy(asc(workOrders.receivedAt))
        .limit(20),

      db
        .select({ id: resources.id, name: resources.name, resourceType: resources.resourceType })
        .from(resources)
        .where(eq(resources.isActive, true))
        .orderBy(asc(resources.sortOrder)),
    ]);
  } catch (err) {
    console.error("[kalender/dag] DB query failed:", err);
  }

  // Serialize dates for client component
  const serializedAppts = appts.map((a) => ({
    ...a,
    scheduledStart: a.scheduledStart instanceof Date ? a.scheduledStart.toISOString() : String(a.scheduledStart),
    scheduledEnd:   a.scheduledEnd instanceof Date ? a.scheduledEnd.toISOString() : String(a.scheduledEnd),
  }));

  return (
    <DayCalendar
      appointments={serializedAppts}
      resources={resourceList}
      workOrders={activeOrders}
      targetDate={targetDate.toISOString()}
      prevDate={prevDate}
      nextDate={nextDate}
      isToday={isToday}
    />
  );
}

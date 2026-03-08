import { db } from "@/lib/db";
import { appointments, resources, vehicles, customers, openingHours } from "@/lib/db/schemas";
import { and, gte, lte, ne, eq, asc } from "drizzle-orm";
import { startOfWeek, endOfWeek, addWeeks } from "date-fns";
import WeekCalendar from "@/components/kalender/WeekCalendar";
import { PartsAlert } from "@/components/kalender/PartsAlert";

export const metadata = { title: "Kalender" };
export const dynamic = "force-dynamic";

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const weekOffset = parseInt(searchParams.week ?? "0");
  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  let appts: any[] = [];
  let resourceList: any[] = [];
  let hours: any[] = [];

  try {
    [appts, resourceList, hours] = await Promise.all([
      db
        .select({
          id:                 appointments.id,
          scheduledStart:     appointments.scheduledStart,
          scheduledEnd:       appointments.scheduledEnd,
          status:             appointments.status,
          serviceDescription: appointments.serviceDescription,
          resourceId:         appointments.resourceId,
          vehicleRegNr:       vehicles.regNr,
          vehicleBrand:       vehicles.brand,
          vehicleModel:       vehicles.model,
          customerFirst:      customers.firstName,
          customerLast:       customers.lastName,
          customerCo:         customers.companyName,
        })
        .from(appointments)
        .innerJoin(vehicles, eq(appointments.vehicleId, vehicles.id))
        .innerJoin(customers, eq(appointments.customerId, customers.id))
        .where(
          and(
            ne(appointments.status, "cancelled"),
            gte(appointments.scheduledStart, weekStart),
            lte(appointments.scheduledStart, weekEnd),
          ),
        )
        .orderBy(asc(appointments.scheduledStart)),

      db
        .select({ id: resources.id, name: resources.name, resourceType: resources.resourceType })
        .from(resources)
        .where(eq(resources.isActive, true))
        .orderBy(asc(resources.sortOrder)),

      db
        .select({
          dayOfWeek: openingHours.dayOfWeek,
          openTime:  openingHours.openTime,
          closeTime: openingHours.closeTime,
          isClosed:  openingHours.isClosed,
        })
        .from(openingHours),
    ]);
  } catch (err) {
    console.error("[kalender] DB query failed:", err);
  }

  // Serialize dates to strings for client component
  const serializedAppts = appts.map((a) => ({
    ...a,
    scheduledStart: a.scheduledStart instanceof Date ? a.scheduledStart.toISOString() : String(a.scheduledStart),
    scheduledEnd:   a.scheduledEnd instanceof Date ? a.scheduledEnd.toISOString() : String(a.scheduledEnd),
  }));

  return (
    <div className="space-y-3">
      <PartsAlert
        weekStart={weekStart.toISOString()}
        weekEnd={weekEnd.toISOString()}
      />
      <WeekCalendar
        appointments={serializedAppts}
        resources={resourceList}
        openingHours={hours}
        weekOffset={weekOffset}
        weekStart={weekStart.toISOString()}
      />
    </div>
  );
}

import { db } from "@/lib/db";
import { openingHours, blockedPeriods, appointments, resources } from "@/lib/db/schemas";
import { and, eq, gte, lte, ne, or, isNull } from "drizzle-orm";
import { addMinutes, addDays, startOfDay, endOfDay, parseISO, format, isWithinInterval } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = "Europe/Stockholm";
const DEFAULT_SLOT_MINUTES = 60;

export interface TimeSlot {
  start: string;        // ISO string
  end: string;          // ISO string
  resourceId: string;
  resourceName: string;
  available: boolean;
}

export interface AvailabilityDay {
  date: string;         // YYYY-MM-DD
  isOpen: boolean;
  slots: TimeSlot[];
}

/**
 * Returns available time slots for the next `days` days.
 * Subtracts blocked periods and existing appointments from opening hours.
 */
export async function getAvailability(
  days = 30,
  slotDurationMinutes = DEFAULT_SLOT_MINUTES,
  fromDate?: Date,
): Promise<AvailabilityDay[]> {
  const start = fromDate ?? new Date();
  const results: AvailabilityDay[] = [];

  // Fetch all opening hours
  const hours = await db.select().from(openingHours);
  const hoursMap = new Map(hours.map((h) => [Number(h.dayOfWeek), h]));

  // Fetch active resources
  const activeResources = await db
    .select()
    .from(resources)
    .where(eq(resources.isActive, true));

  if (activeResources.length === 0) return results;

  const periodEnd = addDays(start, days);

  // Fetch all blocks and appointments in range
  const blocks = await db
    .select()
    .from(blockedPeriods)
    .where(
      and(
        lte(blockedPeriods.blockStart, periodEnd),
        gte(blockedPeriods.blockEnd, start),
      ),
    );

  const existingAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        ne(appointments.status, "cancelled"),
        lte(appointments.scheduledStart, periodEnd),
        gte(appointments.scheduledEnd, start),
      ),
    );

  // For each day in range
  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const currentDay = addDays(start, dayOffset);
    // ISO weekday: getDay() returns 0=Sun, we need 1=Mon..7=Sun
    const rawDay = currentDay.getDay();
    const isoDay = rawDay === 0 ? 7 : rawDay;
    const dayHours = hoursMap.get(isoDay);

    const dateStr = format(currentDay, "yyyy-MM-dd");

    if (!dayHours || dayHours.isClosed === "true") {
      results.push({ date: dateStr, isOpen: false, slots: [] });
      continue;
    }

    const dayStart = fromZonedTime(
      new Date(`${dateStr}T${dayHours.openTime}:00`),
      TIMEZONE,
    );
    const dayEnd = fromZonedTime(
      new Date(`${dateStr}T${dayHours.closeTime}:00`),
      TIMEZONE,
    );

    // Check if whole day is globally blocked (no resource filter)
    const isWholeDayBlocked = blocks.some(
      (b) =>
        b.resourceId === null &&
        b.mechanicId === null &&
        b.blockStart <= dayEnd &&
        b.blockEnd >= dayStart,
    );

    if (isWholeDayBlocked) {
      results.push({ date: dateStr, isOpen: false, slots: [] });
      continue;
    }

    const slots: TimeSlot[] = [];

    // Generate slots for each resource
    for (const resource of activeResources) {
      const resourceBlocks = blocks.filter(
        (b) => b.resourceId === resource.id || (b.resourceId === null && b.mechanicId === null),
      );

      const resourceAppointments = existingAppointments.filter(
        (a) => a.resourceId === resource.id,
      );

      // Generate candidate slot start times
      let slotStart = dayStart;
      while (addMinutes(slotStart, slotDurationMinutes) <= dayEnd) {
        const slotEnd = addMinutes(slotStart, slotDurationMinutes);

        // Check against blocks
        const blockedByPeriod = resourceBlocks.some(
          (b) => b.blockStart < slotEnd && b.blockEnd > slotStart,
        );

        // Check against existing appointments
        const blockedByAppointment = resourceAppointments.some(
          (a) =>
            a.scheduledStart < slotEnd && a.scheduledEnd > slotStart,
        );

        if (!blockedByPeriod && !blockedByAppointment) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            resourceId: resource.id,
            resourceName: resource.name,
            available: true,
          });
        }

        slotStart = addMinutes(slotStart, slotDurationMinutes);
      }
    }

    results.push({ date: dateStr, isOpen: true, slots });
  }

  return results;
}

/**
 * Checks if a specific time slot is available on a given resource.
 * Returns true if no conflicting appointments or blocks exist.
 */
export async function isSlotAvailable(
  resourceId: string,
  start: Date,
  end: Date,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const conditions = [
    eq(appointments.resourceId, resourceId),
    ne(appointments.status, "cancelled"),
    // Overlap: start < end AND end > start
    lte(appointments.scheduledStart, end),
    gte(appointments.scheduledEnd, start),
  ];

  if (excludeAppointmentId) {
    conditions.push(ne(appointments.id, excludeAppointmentId));
  }

  const conflicts = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(...conditions))
    .limit(1);

  return conflicts.length === 0;
}

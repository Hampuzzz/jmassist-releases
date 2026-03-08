import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schemas";
import { and, eq, ne, lte, gte } from "drizzle-orm";

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingAppointmentId?: string;
  message?: string;
}

/**
 * Checks if booking a resource for the given time range would conflict
 * with an existing appointment on the same resource.
 *
 * The PostgreSQL exclusion constraint handles this at DB level,
 * but this function provides a user-friendly pre-check with detail.
 */
export async function checkResourceConflict(
  resourceId: string,
  scheduledStart: Date,
  scheduledEnd: Date,
  excludeAppointmentId?: string,
): Promise<ConflictCheckResult> {
  const conditions = [
    eq(appointments.resourceId, resourceId),
    ne(appointments.status, "cancelled"),
    // Overlap condition: existing.start < new.end AND existing.end > new.start
    lte(appointments.scheduledStart, scheduledEnd),
    gte(appointments.scheduledEnd, scheduledStart),
  ];

  if (excludeAppointmentId) {
    conditions.push(ne(appointments.id, excludeAppointmentId));
  }

  const conflicts = await db
    .select({
      id: appointments.id,
      scheduledStart: appointments.scheduledStart,
      scheduledEnd: appointments.scheduledEnd,
    })
    .from(appointments)
    .where(and(...conditions))
    .limit(1);

  if (conflicts.length === 0) {
    return { hasConflict: false };
  }

  return {
    hasConflict: true,
    conflictingAppointmentId: conflicts[0].id,
    message: `Resursen är redan bokad ${conflicts[0].scheduledStart.toLocaleString("sv-SE")} - ${conflicts[0].scheduledEnd.toLocaleString("sv-SE")}`,
  };
}

/**
 * Checks mechanic availability (not a hard constraint, but a soft warning).
 */
export async function checkMechanicConflict(
  mechanicId: string,
  scheduledStart: Date,
  scheduledEnd: Date,
  excludeAppointmentId?: string,
): Promise<ConflictCheckResult> {
  const conditions = [
    eq(appointments.mechanicId, mechanicId),
    ne(appointments.status, "cancelled"),
    lte(appointments.scheduledStart, scheduledEnd),
    gte(appointments.scheduledEnd, scheduledStart),
  ];

  if (excludeAppointmentId) {
    conditions.push(ne(appointments.id, excludeAppointmentId));
  }

  const conflicts = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(...conditions))
    .limit(1);

  if (conflicts.length === 0) return { hasConflict: false };

  return {
    hasConflict: true,
    conflictingAppointmentId: conflicts[0].id,
    message: "Mekanikern har redan en bokning under denna tid",
  };
}

import { db } from "@/lib/db";
import { workshopSettings } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { WORKSHOP_HOURLY_RATE_DEFAULT } from "@/lib/constants";

/**
 * Read the workshop hourly rate from the database (workshop_settings table).
 * Falls back to WORKSHOP_HOURLY_RATE_DEFAULT (850) if not set.
 */
export async function getWorkshopHourlyRate(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: workshopSettings.value })
      .from(workshopSettings)
      .where(eq(workshopSettings.key, "workshop_hourly_rate"));

    if (row?.value) {
      const parsed = parseFloat(row.value);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (err) {
    console.error("[workshop-rate] Failed to read rate from DB:", err);
  }

  return WORKSHOP_HOURLY_RATE_DEFAULT;
}

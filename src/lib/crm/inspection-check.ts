import { db } from "@/lib/db";
import { vehicles, customers } from "@/lib/db/schemas";
import { eq, isNotNull, and } from "drizzle-orm";

interface InspectionAlert {
  vehicleId:    string;
  regNr:        string;
  brand:        string;
  model:        string;
  modelYear:    number | null;
  customerId:   string | null;
  customerName: string | null;
  phone:        string | null;
  inspectionDue: Date;
  daysRemaining: number;
  source:       "enrichment" | "estimated";
}

/**
 * Find vehicles with upcoming mandatory inspections (besiktning).
 * Checks enrichment data first, falls back to age-based estimation.
 *
 * Swedish inspection rules:
 * - New cars: first at 3 years, then every 2 years until 8 years
 * - 8+ years: every year (14 months between inspections)
 */
export async function checkUpcomingInspections(withinDays: number = 60): Promise<InspectionAlert[]> {
  // Get all active vehicles with customers
  const allVehicles = await db
    .select({
      id: vehicles.id,
      regNr: vehicles.regNr,
      brand: vehicles.brand,
      model: vehicles.model,
      modelYear: vehicles.modelYear,
      customerId: vehicles.customerId,
      externalData: vehicles.externalData,
    })
    .from(vehicles)
    .where(and(vehicles.isActive, isNotNull(vehicles.customerId)));

  const alerts: InspectionAlert[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  for (const v of allVehicles) {
    let inspectionDue: Date | null = null;
    let source: "enrichment" | "estimated" = "estimated";

    // Try to get from enrichment data
    const ext = v.externalData as Record<string, unknown> | null;
    if (ext?.next_inspection || ext?.inspection_date) {
      const dateStr = (ext.next_inspection ?? ext.inspection_date) as string;
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        inspectionDue = parsed;
        source = "enrichment";
      }
    }

    // Fallback: estimate based on model year
    if (!inspectionDue && v.modelYear) {
      const age = now.getFullYear() - v.modelYear;
      if (age >= 3) {
        // Rough estimate: assume inspection is due around the registration anniversary
        // This is imprecise but useful for flagging vehicles
        const month = (v.modelYear * 7) % 12; // deterministic month based on year
        const nextYear = age >= 8
          ? now.getFullYear() // yearly
          : now.getFullYear() + (now.getMonth() > month ? 1 : 0); // every other year approx
        inspectionDue = new Date(nextYear, month, 15);
      }
    }

    if (!inspectionDue) continue;

    // Check if within the alert window
    const daysRemaining = Math.floor((inspectionDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysRemaining > withinDays || daysRemaining < -30) continue; // Skip if too far or very overdue

    // Get customer info
    let customerName: string | null = null;
    let phone: string | null = null;
    if (v.customerId) {
      const [cust] = await db
        .select({ firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName, phone: customers.phone })
        .from(customers)
        .where(eq(customers.id, v.customerId));
      if (cust) {
        customerName = cust.companyName ?? [cust.firstName, cust.lastName].filter(Boolean).join(" ");
        phone = cust.phone;
      }
    }

    alerts.push({
      vehicleId: v.id,
      regNr: v.regNr,
      brand: v.brand,
      model: v.model,
      modelYear: v.modelYear,
      customerId: v.customerId,
      customerName,
      phone,
      inspectionDue,
      daysRemaining,
      source,
    });
  }

  // Sort by most urgent first
  alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return alerts;
}

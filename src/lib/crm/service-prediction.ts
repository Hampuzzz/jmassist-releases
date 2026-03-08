import { db } from "@/lib/db";
import { workOrders, vehicles } from "@/lib/db/schemas";
import { eq, desc, isNotNull, and } from "drizzle-orm";

interface ServicePrediction {
  vehicleId:     string;
  regNr:         string;
  lastServiceDate: Date | null;
  lastMileage:   number | null;
  avgKmPerMonth: number | null;
  nextServiceDate: Date | null;
  nextServiceKm: number | null;
  confidence:    "high" | "medium" | "low";
}

const SERVICE_INTERVAL_KM = 15_000;
const SERVICE_INTERVAL_MONTHS = 12;

/**
 * Predict next service date for a vehicle based on historical mileage data.
 */
export async function predictNextService(vehicleId: string): Promise<ServicePrediction | null> {
  // Get vehicle info
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId));

  if (!vehicle) return null;

  // Get work orders with mileage readings, ordered by date
  const orders = await db
    .select({
      id: workOrders.id,
      mileageIn: workOrders.mileageIn,
      receivedAt: workOrders.receivedAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.vehicleId, vehicleId),
        isNotNull(workOrders.mileageIn),
      ),
    )
    .orderBy(desc(workOrders.receivedAt));

  const lastOrder = orders[0];
  const lastServiceDate = lastOrder?.receivedAt ?? null;
  const lastMileage = lastOrder?.mileageIn ?? vehicle.mileageKm ?? null;

  // Calculate average km/month from mileage history
  let avgKmPerMonth: number | null = null;
  let confidence: "high" | "medium" | "low" = "low";

  if (orders.length >= 2) {
    // Use first and last mileage readings
    const newest = orders[0];
    const oldest = orders[orders.length - 1];
    const mileageDiff = (newest.mileageIn ?? 0) - (oldest.mileageIn ?? 0);
    const monthsDiff = (newest.receivedAt.getTime() - oldest.receivedAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    if (monthsDiff > 1 && mileageDiff > 0) {
      avgKmPerMonth = Math.round(mileageDiff / monthsDiff);
      confidence = orders.length >= 4 ? "high" : "medium";
    }
  }

  // Fallback: assume 1200 km/month (Swedish average ~15,000 km/year)
  if (!avgKmPerMonth) {
    avgKmPerMonth = 1250;
    confidence = "low";
  }

  // Calculate next service date
  let nextServiceDate: Date | null = null;
  let nextServiceKm: number | null = null;

  if (lastMileage && lastServiceDate) {
    // Km-based: when will they reach next 15,000 km interval?
    const kmSinceService = vehicle.mileageKm
      ? vehicle.mileageKm - lastMileage
      : 0;
    const kmRemaining = SERVICE_INTERVAL_KM - kmSinceService;
    const monthsUntilKm = kmRemaining / avgKmPerMonth;

    // Time-based: 12 months from last service
    const monthsSinceService = (Date.now() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const monthsUntilTime = SERVICE_INTERVAL_MONTHS - monthsSinceService;

    // Use whichever comes first
    const monthsUntil = Math.min(monthsUntilKm, monthsUntilTime);
    nextServiceDate = new Date(Date.now() + monthsUntil * 30.44 * 24 * 60 * 60 * 1000);
    nextServiceKm = lastMileage + SERVICE_INTERVAL_KM;
  } else {
    // No history — assume service needed in 6 months
    nextServiceDate = new Date(Date.now() + 6 * 30.44 * 24 * 60 * 60 * 1000);
    confidence = "low";
  }

  return {
    vehicleId,
    regNr: vehicle.regNr,
    lastServiceDate,
    lastMileage,
    avgKmPerMonth,
    nextServiceDate,
    nextServiceKm,
    confidence,
  };
}

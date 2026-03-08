import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicles, vehicleHealthChecks, vhcItems } from "@/lib/db/schemas";
import { eq, and, desc } from "drizzle-orm";
import { getPortalCustomer } from "@/lib/portal/auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const [vehicle] = await db.select().from(vehicles).where(and(eq(vehicles.id, params.id), eq(vehicles.customerId, customer.customerId)));
  if (!vehicle) return NextResponse.json({ error: "Fordon hittades inte" }, { status: 404 });

  // Get VHC reports for this vehicle
  const vhcReports = await db.select().from(vehicleHealthChecks).where(eq(vehicleHealthChecks.vehicleId, vehicle.id)).orderBy(desc(vehicleHealthChecks.createdAt));

  const reportsWithItems = await Promise.all(vhcReports.map(async (report) => {
    const items = await db.select().from(vhcItems).where(eq(vhcItems.checkId, report.id)).orderBy(vhcItems.sortOrder);
    return {
      id: report.id,
      date: report.createdAt.toISOString(),
      items: items.map(item => ({
        name: item.label,
        status: item.severity,
        notes: item.comment,
        images: item.mediaUrls || [],
      })),
    };
  }));

  return NextResponse.json({
    id: vehicle.id, registration_number: vehicle.regNr, make: vehicle.brand,
    model: vehicle.model, year: vehicle.modelYear, vin: vehicle.vin,
    mileage: vehicle.mileageKm, vhc_reports: reportsWithItems,
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmReminders, vehicles } from "@/lib/db/schemas";
import { eq, and, asc } from "drizzle-orm";
import { getPortalCustomer } from "@/lib/portal/auth";

export async function GET(request: Request) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const reminders = await db.select().from(crmReminders).where(and(eq(crmReminders.customerId, customer.customerId), eq(crmReminders.status, "sent"))).orderBy(asc(crmReminders.dueDate));

  const result = await Promise.all(reminders.map(async (r) => {
    let vehicle = undefined;
    if (r.vehicleId) {
      const [v] = await db.select().from(vehicles).where(eq(vehicles.id, r.vehicleId));
      if (v) vehicle = { id: v.id, registration_number: v.regNr, make: v.brand, model: v.model, year: v.modelYear };
    }
    return { id: r.id, type: r.type, message: r.message, due_date: r.dueDate, vehicle };
  }));

  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { crmReminders, customers, vehicles } from "@/lib/db/schemas";
import { eq, desc, and, or } from "drizzle-orm";
import { checkUpcomingInspections } from "@/lib/crm/inspection-check";
import { inspectionReminderSms, serviceReminderSms, tireChangeReminderSms } from "@/lib/integrations/sms/templates";

/**
 * GET /api/crm/reminders
 * List all CRM reminders, optionally filtered by status.
 * Query: ?status=pending&type=inspection
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status");
  const type = request.nextUrl.searchParams.get("type");

  let query = db
    .select({
      id: crmReminders.id,
      customerId: crmReminders.customerId,
      vehicleId: crmReminders.vehicleId,
      type: crmReminders.type,
      title: crmReminders.title,
      message: crmReminders.message,
      dueDate: crmReminders.dueDate,
      status: crmReminders.status,
      sentAt: crmReminders.sentAt,
      createdAt: crmReminders.createdAt,
      customerName: customers.firstName,
      customerLast: customers.lastName,
      companyName: customers.companyName,
      phone: customers.phone,
      regNr: vehicles.regNr,
      brand: vehicles.brand,
      model: vehicles.model,
    })
    .from(crmReminders)
    .leftJoin(customers, eq(crmReminders.customerId, customers.id))
    .leftJoin(vehicles, eq(crmReminders.vehicleId, vehicles.id))
    .orderBy(desc(crmReminders.createdAt))
    .$dynamic();

  // Apply filters
  const conditions = [];
  if (status) conditions.push(eq(crmReminders.status, status));
  if (type) conditions.push(eq(crmReminders.type, type));
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const data = await query.limit(200);
  return NextResponse.json(data);
}

/**
 * POST /api/crm/reminders
 * Generate reminders based on inspection/service predictions.
 * Body: { type: "inspection" | "service" | "tire_change" }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await request.json();
  let created = 0;

  if (type === "inspection") {
    const alerts = await checkUpcomingInspections(60);

    for (const alert of alerts) {
      if (!alert.customerId || !alert.phone) continue;

      // Check if reminder already exists
      const existing = await db
        .select({ id: crmReminders.id })
        .from(crmReminders)
        .where(
          and(
            eq(crmReminders.vehicleId, alert.vehicleId),
            eq(crmReminders.type, "inspection"),
            or(eq(crmReminders.status, "pending"), eq(crmReminders.status, "approved")),
          ),
        );

      if (existing.length > 0) continue;

      const dueStr = alert.inspectionDue.toLocaleDateString("sv-SE");
      const message = inspectionReminderSms(alert.customerName ?? "Kund", alert.regNr, dueStr);

      await db.insert(crmReminders).values({
        customerId: alert.customerId,
        vehicleId: alert.vehicleId,
        type: "inspection",
        title: `Besiktning ${alert.regNr}`,
        message,
        dueDate: alert.inspectionDue.toISOString().split("T")[0],
      });
      created++;
    }
  }

  return NextResponse.json({ created, type });
}

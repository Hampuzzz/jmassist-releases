import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { crmReminders, customers } from "@/lib/db/schemas";
import { eq, and } from "drizzle-orm";
import { sendSms } from "@/lib/integrations/sms/client";

/**
 * POST /api/crm/reminders/send
 * Send all approved reminders via SMS.
 * Body: { ids?: string[] } — optional: send specific IDs only
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = (await request.json()) as { ids?: string[] };

  // Get approved reminders
  let reminders;
  if (ids && ids.length > 0) {
    reminders = await db
      .select({
        id: crmReminders.id,
        customerId: crmReminders.customerId,
        message: crmReminders.message,
        phone: customers.phone,
      })
      .from(crmReminders)
      .leftJoin(customers, eq(crmReminders.customerId, customers.id))
      .where(eq(crmReminders.status, "approved"));

    reminders = reminders.filter((r) => ids.includes(r.id));
  } else {
    reminders = await db
      .select({
        id: crmReminders.id,
        customerId: crmReminders.customerId,
        message: crmReminders.message,
        phone: customers.phone,
      })
      .from(crmReminders)
      .leftJoin(customers, eq(crmReminders.customerId, customers.id))
      .where(eq(crmReminders.status, "approved"));
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    if (!reminder.phone) {
      failed++;
      continue;
    }

    try {
      await sendSms(reminder.phone, reminder.message);
      await db
        .update(crmReminders)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(crmReminders.id, reminder.id));
      sent++;
    } catch (err: any) {
      console.error(`[crm] SMS failed for reminder ${reminder.id}:`, err.message);
      failed++;
    }

    // Brief delay between SMS to avoid rate limiting
    if (sent > 0) await new Promise((r) => setTimeout(r, 500));
  }

  return NextResponse.json({ sent, failed, total: reminders.length });
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_ROLES } from "@/lib/middleware/require-role";
import { db } from "@/lib/db";
import { crmReminders, customers } from "@/lib/db/schemas";
import { eq, and, inArray } from "drizzle-orm";
import { sendSms } from "@/lib/integrations/sms/client";

/**
 * POST /api/crm/reminders/send
 * Send all approved reminders via SMS.
 * Body: { ids?: string[] } — optional: send specific IDs only
 */
export async function POST(request: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (guard.error) return guard.error;
  const user = guard.user;

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
  const sentIds: string[] = [];

  for (const reminder of reminders) {
    if (!reminder.phone) {
      failed++;
      continue;
    }

    try {
      await sendSms(reminder.phone, reminder.message, {
        type: "crm_reminder",
        customerId: reminder.customerId,
        relatedEntityType: "crm_reminder",
        relatedEntityId: reminder.id,
      });
      sentIds.push(reminder.id);
      sent++;
    } catch (err: any) {
      console.error(`[crm] SMS failed for reminder ${reminder.id}:`, err.message);
      failed++;
    }

    // Brief delay between SMS to avoid rate limiting
    if (sent > 0) await new Promise((r) => setTimeout(r, 500));
  }

  // Batch update all successfully sent reminders in one query
  if (sentIds.length > 0) {
    await db
      .update(crmReminders)
      .set({ status: "sent", sentAt: new Date() })
      .where(inArray(crmReminders.id, sentIds));
  }

  return NextResponse.json({ sent, failed, total: reminders.length });
}

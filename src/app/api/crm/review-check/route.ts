import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { invoices, customers, workshopSettings } from "@/lib/db/schemas";
import { eq, and, isNull, isNotNull, lte, sql } from "drizzle-orm";
import { reviewRequestSms } from "@/lib/integrations/sms/templates";

export const dynamic = "force-dynamic";

/**
 * POST /api/crm/review-check
 * Checks for paid invoices that are ready for a review SMS.
 * Should be called periodically (e.g. cron or manual).
 */
export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get settings
  const settingsRows = await db.select().from(workshopSettings);
  const settings: Record<string, string> = {};
  for (const r of settingsRows) settings[r.key] = r.value;

  if (settings.loyalty_review_sms_enabled !== "true") {
    return NextResponse.json({ sent: 0, message: "Recensions-SMS är inaktiverat" });
  }

  const reviewUrl = settings.loyalty_google_review_url ?? "";
  if (!reviewUrl) {
    return NextResponse.json({ sent: 0, message: "Ingen recensions-URL konfigurerad" });
  }

  const delayHours = parseInt(settings.loyalty_review_delay_hours ?? "24", 10);
  const cutoff = new Date(Date.now() - delayHours * 3_600_000);

  // Find paid invoices where delay has passed and no review SMS sent yet
  const eligibleInvoices = await db
    .select({
      id: invoices.id,
      customerId: invoices.customerId,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        isNotNull(invoices.paidAt),
        lte(invoices.paidAt, cutoff),
        isNull(invoices.reviewSmsSentAt),
      ),
    )
    .limit(50);

  let sent = 0;

  for (const inv of eligibleInvoices) {
    try {
      // Get customer phone
      const [customer] = await db
        .select({
          phone: customers.phone,
          firstName: customers.firstName,
          lastName: customers.lastName,
          companyName: customers.companyName,
        })
        .from(customers)
        .where(eq(customers.id, inv.customerId));

      if (!customer?.phone) {
        // Mark as sent to avoid re-checking
        await db
          .update(invoices)
          .set({ reviewSmsSentAt: new Date() })
          .where(eq(invoices.id, inv.id));
        continue;
      }

      const name = customer.companyName ??
        [customer.firstName, customer.lastName].filter(Boolean).join(" ") ?? "Kund";

      const smsBody = reviewRequestSms(name, reviewUrl);

      // Send SMS via 46elks
      const { sendSms } = await import("@/lib/integrations/sms/client");
      await sendSms(customer.phone, smsBody, {
        type: "review_request",
        customerId: inv.customerId,
        recipientName: name,
        relatedEntityType: "invoice",
        relatedEntityId: inv.id,
      });

      // Mark as sent
      await db
        .update(invoices)
        .set({ reviewSmsSentAt: new Date() })
        .where(eq(invoices.id, inv.id));

      sent++;
    } catch (err) {
      console.error(`[review-check] Failed for invoice ${inv.id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}

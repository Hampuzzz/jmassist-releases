import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { messageLogs, customers } from "@/lib/db/schemas";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/meddelanden
 * Fetch message log with optional filters.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  const rows = await db
    .select({
      id: messageLogs.id,
      channel: messageLogs.channel,
      type: messageLogs.type,
      recipientPhone: messageLogs.recipientPhone,
      recipientEmail: messageLogs.recipientEmail,
      recipientName: messageLogs.recipientName,
      message: messageLogs.message,
      status: messageLogs.status,
      externalId: messageLogs.externalId,
      costSek: messageLogs.costSek,
      errorMessage: messageLogs.errorMessage,
      relatedEntityType: messageLogs.relatedEntityType,
      sentAt: messageLogs.sentAt,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerCompany: customers.companyName,
    })
    .from(messageLogs)
    .leftJoin(customers, eq(messageLogs.customerId, customers.id))
    .orderBy(desc(messageLogs.sentAt))
    .limit(limit);

  return NextResponse.json({
    messages: rows.map((r) => ({
      ...r,
      sentAt: r.sentAt instanceof Date ? r.sentAt.toISOString() : r.sentAt,
    })),
  });
}

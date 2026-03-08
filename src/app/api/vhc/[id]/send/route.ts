import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicleHealthChecks, vehicles, customers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { sendSms } from "@/lib/integrations/sms/client";
import { vhcReportSms } from "@/lib/integrations/sms/templates";

/**
 * POST /api/vhc/[id]/send
 * Send VHC report to customer via SMS with public link.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get VHC
  const [vhc] = await db
    .select()
    .from(vehicleHealthChecks)
    .where(eq(vehicleHealthChecks.id, params.id));

  if (!vhc) {
    return NextResponse.json({ error: "VHC hittades inte" }, { status: 404 });
  }

  // Get vehicle & customer
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, vhc.vehicleId));

  if (!vehicle?.customerId) {
    return NextResponse.json({ error: "Fordonet har ingen kopplad kund" }, { status: 400 });
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, vehicle.customerId));

  if (!customer?.phone) {
    return NextResponse.json({ error: "Kunden saknar telefonnummer" }, { status: 400 });
  }

  // Build public URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const checkupUrl = `${baseUrl}/checkup/${vhc.publicToken}`;

  // Build customer name
  const customerName = customer.companyName
    ?? [customer.firstName, customer.lastName].filter(Boolean).join(" ")
    ?? "Kund";

  // Send SMS
  const message = vhcReportSms(customerName, vehicle.regNr, checkupUrl);

  try {
    await sendSms(customer.phone, message);
  } catch (err: any) {
    return NextResponse.json(
      { error: `SMS-fel: ${err.message}`, checkupUrl },
      { status: 502 },
    );
  }

  // Update VHC status
  await db
    .update(vehicleHealthChecks)
    .set({
      status: "sent",
      customerNotifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vehicleHealthChecks.id, vhc.id));

  return NextResponse.json({
    success: true,
    checkupUrl,
    sentTo: customer.phone,
    message: `SMS skickat till ${customerName}`,
  });
}

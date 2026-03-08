import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  vehicleHealthChecks, vhcItems, workOrders, vehicles, customers,
} from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sendSms } from "@/lib/integrations/sms/client";
import { vhcReportSms } from "@/lib/integrations/sms/templates";

/**
 * POST /api/arbetsorder/[id]/quick-vhc
 * Quick-create a VHC with a single custom item (e.g. from a video recording)
 * and optionally send SMS to customer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { label, comment, estimatedCost, mediaUrls, sendSms: shouldSend } = body;

  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "Beskrivning (label) krävs" }, { status: 400 });
  }

  const workOrderId = params.id;

  try {
    // 1. Fetch work order → vehicleId, customerId
    const [wo] = await db
      .select({
        vehicleId:  workOrders.vehicleId,
        customerId: workOrders.customerId,
      })
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId));

    if (!wo) {
      return NextResponse.json({ error: "Arbetsorder hittades inte" }, { status: 404 });
    }

    // 2. Check for existing VHC on this work order
    const [existingVhc] = await db
      .select()
      .from(vehicleHealthChecks)
      .where(eq(vehicleHealthChecks.workOrderId, workOrderId));

    let vhcId: string;
    let publicToken: string;
    let isNew = false;

    if (existingVhc) {
      vhcId = existingVhc.id;
      publicToken = existingVhc.publicToken!;
    } else {
      // Create new VHC (without 37 default items — just for quick video)
      publicToken = randomUUID();
      const [newVhc] = await db
        .insert(vehicleHealthChecks)
        .values({
          workOrderId,
          vehicleId: wo.vehicleId,
          mechanicId: user.id,
          publicToken,
          status: "draft",
        })
        .returning();
      vhcId = newVhc.id;
      isNew = true;
    }

    // 3. Insert the single custom vhc_item
    const [newItem] = await db
      .insert(vhcItems)
      .values({
        checkId: vhcId,
        category: "custom",
        label: label.trim(),
        severity: "red",
        comment: comment?.trim() || null,
        estimatedCost: estimatedCost ? String(estimatedCost) : null,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
        sortOrder: 999,
      })
      .returning();

    // 4. Build checkup URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const checkupUrl = `${baseUrl}/checkup/${publicToken}`;

    // 5. Optionally send SMS
    let smsSent = false;
    if (shouldSend) {
      const [vehicle] = await db
        .select({ regNr: vehicles.regNr, customerId: vehicles.customerId })
        .from(vehicles)
        .where(eq(vehicles.id, wo.vehicleId));

      const [customer] = await db
        .select({
          phone: customers.phone,
          firstName: customers.firstName,
          lastName: customers.lastName,
          companyName: customers.companyName,
        })
        .from(customers)
        .where(eq(customers.id, wo.customerId));

      if (!customer?.phone) {
        return NextResponse.json(
          { error: "Kunden saknar telefonnummer", vhcId, vhcItemId: newItem.id, checkupUrl },
          { status: 400 },
        );
      }

      const customerName = customer.companyName
        ?? [customer.firstName, customer.lastName].filter(Boolean).join(" ")
        ?? "Kund";

      const message = vhcReportSms(customerName, vehicle?.regNr ?? "", checkupUrl);

      try {
        await sendSms(customer.phone, message);
        smsSent = true;
      } catch (err: any) {
        return NextResponse.json(
          { error: `SMS-fel: ${err.message}`, vhcId, vhcItemId: newItem.id, checkupUrl },
          { status: 502 },
        );
      }

      // Update VHC status to "sent"
      await db
        .update(vehicleHealthChecks)
        .set({ status: "sent", customerNotifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(vehicleHealthChecks.id, vhcId));
    }

    return NextResponse.json(
      { vhcId, vhcItemId: newItem.id, publicToken, checkupUrl, smsSent, isNew },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("[quick-vhc] POST error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte skapa snabb-VHC" },
      { status: 500 },
    );
  }
}

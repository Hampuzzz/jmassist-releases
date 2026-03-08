import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

/**
 * GET /api/faktura/[id]/swish-qr
 * Generates a Swish QR code as an SVG for the invoice.
 * The Swish QR format is: C{swishNumber};{amount};{message};0
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const swishNumber = process.env.WORKSHOP_SWISH;
  if (!swishNumber) {
    return NextResponse.json(
      { error: "Swish-nummer ej konfigurerat (WORKSHOP_SWISH)" },
      { status: 400 },
    );
  }

  try {
    const [invoice] = await db
      .select({
        id:            invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        totalIncVat:   invoices.totalIncVat,
        status:        invoices.status,
      })
      .from(invoices)
      .where(eq(invoices.id, params.id));

    if (!invoice) {
      return NextResponse.json({ error: "Faktura hittades inte" }, { status: 404 });
    }

    const amount = parseFloat(invoice.totalIncVat);
    const message = invoice.invoiceNumber ?? `Faktura-${invoice.id.slice(0, 8)}`;

    // Swish QR payload format: C{number};{amount};{message};0
    // C = Prefilled amount (can't be changed by payer)
    const swishPayload = `C${swishNumber};${amount.toFixed(2)};${message};0`;

    // Generate QR as SVG
    const svg = await QRCode.toString(swishPayload, {
      type: "svg",
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    // Also generate as data URL for embedding
    const dataUrl = await QRCode.toDataURL(swishPayload, {
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    return NextResponse.json({
      data: {
        svg,
        dataUrl,
        payload: swishPayload,
        amount: amount.toFixed(2),
        message,
        swishNumber,
      },
    });
  } catch (err: any) {
    console.error("[swish-qr] Error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte skapa QR-kod." },
      { status: 500 },
    );
  }
}

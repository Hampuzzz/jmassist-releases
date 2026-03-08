import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { customers, vehicles, invoices } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, params.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Kunden hittades inte" }, { status: 404 });
    }

    return NextResponse.json({ data: customer });
  } catch (err) {
    console.error("[kunder] GET by id failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Check for related invoices
    const relatedInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.customerId, params.id))
      .limit(1);

    if (relatedInvoices.length > 0) {
      return NextResponse.json(
        { error: "Kunden har relaterade fakturor eller fordon och kan inte tas bort." },
        { status: 409 },
      );
    }

    // Check for related vehicles
    const relatedVehicles = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(eq(vehicles.customerId, params.id))
      .limit(1);

    if (relatedVehicles.length > 0) {
      return NextResponse.json(
        { error: "Kunden har relaterade fakturor eller fordon och kan inte tas bort." },
        { status: 409 },
      );
    }

    const deleted = await db
      .delete(customers)
      .where(eq(customers.id, params.id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Kunden hittades inte" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kunder] Delete failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}

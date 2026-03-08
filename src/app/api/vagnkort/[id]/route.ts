import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicles, workOrders } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { updateVehicleSchema } from "@/lib/validations/vehicle";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, params.id))
      .limit(1);

    if (!vehicle) {
      return NextResponse.json({ error: "Fordonet hittades inte" }, { status: 404 });
    }

    return NextResponse.json({ data: vehicle });
  } catch (err) {
    console.error("[vagnkort] GET by id failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = updateVehicleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await db
      .update(vehicles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(vehicles.id, params.id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: "Fordonet hittades inte" }, { status: 404 });
    }

    return NextResponse.json({ data: updated[0] });
  } catch (err) {
    console.error("[vagnkort] PATCH failed:", err);
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
    // Use transaction to make check + delete atomic
    const deleted = await db.transaction(async (tx) => {
      const relatedWorkOrders = await tx
        .select({ id: workOrders.id })
        .from(workOrders)
        .where(eq(workOrders.vehicleId, params.id))
        .limit(1);

      if (relatedWorkOrders.length > 0) {
        throw new Error("RELATED_RECORDS");
      }

      return tx
        .delete(vehicles)
        .where(eq(vehicles.id, params.id))
        .returning();
    });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Fordonet hittades inte" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === "RELATED_RECORDS") {
      return NextResponse.json(
        { error: "Fordonet har relaterade arbetsordrar och kan inte tas bort." },
        { status: 409 },
      );
    }
    console.error("[vagnkort] Delete failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}

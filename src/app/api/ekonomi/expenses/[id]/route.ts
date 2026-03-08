import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/ekonomi/expenses/[id]
 * Update an expense.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updateFields: Record<string, unknown> = {};

    if (body.date !== undefined) updateFields.date = body.date;
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.amount !== undefined) updateFields.amount = String(body.amount);
    if (body.vatAmount !== undefined) updateFields.vatAmount = String(body.vatAmount);
    if (body.vatDeductible !== undefined) updateFields.vatDeductible = body.vatDeductible;
    if (body.supplier !== undefined) updateFields.supplier = body.supplier || null;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.isRecurring !== undefined) updateFields.isRecurring = body.isRecurring;
    if (body.receiptRef !== undefined) updateFields.receiptRef = body.receiptRef || null;
    updateFields.updatedAt = new Date();

    const [updated] = await db
      .update(expenses)
      .set(updateFields)
      .where(eq(expenses.id, params.id))
      .returning();

    if (!updated) {
      return Response.json({ error: "Utgift hittades inte" }, { status: 404 });
    }

    return Response.json({ data: updated });
  } catch (err) {
    console.error("[expenses] PATCH failed:", err);
    return Response.json({ error: "Kunde inte uppdatera utgift" }, { status: 500 });
  }
}

/**
 * DELETE /api/ekonomi/expenses/[id]
 * Delete an expense.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [deleted] = await db
      .delete(expenses)
      .where(eq(expenses.id, params.id))
      .returning({ id: expenses.id });

    if (!deleted) {
      return Response.json({ error: "Utgift hittades inte" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[expenses] DELETE failed:", err);
    return Response.json({ error: "Kunde inte ta bort utgift" }, { status: 500 });
  }
}

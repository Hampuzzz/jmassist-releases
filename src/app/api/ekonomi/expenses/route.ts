import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schemas";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/ekonomi/expenses?year=2026&month=2
 * Returns all expenses for the given period.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
  const monthParam = url.searchParams.get("month");

  let startDate: string;
  let endDate: string;

  if (monthParam) {
    const month = parseInt(monthParam);
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  try {
    const rows = await db
      .select()
      .from(expenses)
      .where(
        and(
          gte(expenses.date, startDate),
          lte(expenses.date, endDate),
        ),
      )
      .orderBy(desc(expenses.date));

    return Response.json({ data: rows });
  } catch (err) {
    console.error("[expenses] GET failed:", err);
    return Response.json({ error: "Kunde inte hämta utgifter" }, { status: 500 });
  }
}

/**
 * POST /api/ekonomi/expenses
 * Create a new expense.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { date, category, amount, vatAmount, vatDeductible, supplier, description, isRecurring, receiptRef } = body;

    if (!date || !category || amount == null || !description) {
      return Response.json(
        { error: "Datum, kategori, belopp och beskrivning krävs" },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(expenses)
      .values({
        date,
        category,
        amount: String(amount),
        vatAmount: String(vatAmount ?? 0),
        vatDeductible: vatDeductible ?? true,
        supplier: supplier || null,
        description,
        isRecurring: isRecurring ?? false,
        receiptRef: receiptRef || null,
        createdBy: user.id,
      })
      .returning();

    return Response.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("[expenses] POST failed:", err);
    return Response.json({ error: "Kunde inte skapa utgift" }, { status: 500 });
  }
}

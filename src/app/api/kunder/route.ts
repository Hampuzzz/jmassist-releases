import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schemas";
import { eq, desc, or, ilike } from "drizzle-orm";
import { createCustomerSchema } from "@/lib/validations/customer";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search    = searchParams.get("search");
  const isCompany = searchParams.get("is_company");
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));

  let query = db.select({
    id:          customers.id,
    firstName:   customers.firstName,
    lastName:    customers.lastName,
    companyName: customers.companyName,
    email:       customers.email,
    phone:       customers.phone,
    isCompany:   customers.isCompany,
    city:        customers.city,
    orgNr:       customers.orgNr,
    createdAt:   customers.createdAt,
  }).from(customers).orderBy(desc(customers.createdAt));

  if (isCompany !== null) {
    query = query.where(eq(customers.isCompany, isCompany === "true")) as typeof query;
  }

  if (search) {
    query = query.where(
      or(
        ilike(customers.firstName,   `%${search}%`),
        ilike(customers.lastName,    `%${search}%`),
        ilike(customers.companyName, `%${search}%`),
        ilike(customers.email,       `%${search}%`),
        ilike(customers.phone,       `%${search}%`),
      ),
    ) as typeof query;
  }

  const data = await query.limit(limit).offset((page - 1) * limit);
  return NextResponse.json({ data, page, limit }, {
    headers: { "Cache-Control": "private, max-age=0, stale-while-revalidate=30" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valideringsfel", details: parsed.error.flatten() }, { status: 400 });
  }

  const [customer] = await db.insert(customers).values(parsed.data).returning();
  return NextResponse.json({ data: customer }, { status: 201 });
}

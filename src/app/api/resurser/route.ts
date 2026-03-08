import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schemas";
import { asc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";

  let query = db.select().from(resources).orderBy(asc(resources.sortOrder));
  if (activeOnly) query = query.where(eq(resources.isActive, true)) as typeof query;

  const data = await query;
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: "Namn krävs" }, { status: 400 });
  }

  const [resource] = await db.insert(resources).values(body).returning();
  return NextResponse.json({ data: resource }, { status: 201 });
}

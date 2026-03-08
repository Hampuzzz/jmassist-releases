import { NextResponse } from "next/server";
import { getPortalCustomer } from "@/lib/portal/auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  // TODO: Implement PDF generation
  return NextResponse.json({ error: "PDF-generering ej implementerad ännu" }, { status: 501 });
}

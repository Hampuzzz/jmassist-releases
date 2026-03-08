import { NextResponse } from "next/server";
import { getPortalCustomer, signPortalToken } from "@/lib/portal/auth";

export async function POST(request: Request) {
  const customer = await getPortalCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: "Ogiltig token" }, { status: 401 });
  }

  const token = await signPortalToken(customer);
  return NextResponse.json({ token });
}

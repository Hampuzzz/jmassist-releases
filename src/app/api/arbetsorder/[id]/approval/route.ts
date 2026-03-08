import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  workOrders, vehicles, customers,
  inspectionResults, approvalRequests, approvalItems,
} from "@/lib/db/schemas";
import { eq, and } from "drizzle-orm";
import { signApprovalToken } from "@/lib/approval/tokens";

/**
 * POST /api/arbetsorder/[id]/approval
 * Creates an approval request from a work order's failed inspection items.
 * Auth required.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch work order
    const [order] = await db
      .select({
        id:          workOrders.id,
        orderNumber: workOrders.orderNumber,
        vehicleId:   workOrders.vehicleId,
        customerId:  workOrders.customerId,
      })
      .from(workOrders)
      .where(eq(workOrders.id, params.id));

    if (!order) {
      return NextResponse.json({ error: "Arbetsorder hittades inte" }, { status: 404 });
    }

    // Parse request body for custom items (optional)
    let bodyItems: Array<{
      description: string;
      estimatedCost?: number;
      photoUrls?: string[];
      inspectionResultId?: string;
    }> = [];

    try {
      const body = await request.json();
      if (Array.isArray(body.items)) {
        bodyItems = body.items;
      }
    } catch {
      // No body or invalid JSON — that's OK, we'll use inspection results
    }

    // If no custom items, fetch failed inspection results
    if (bodyItems.length === 0) {
      const failedInspections = await db
        .select()
        .from(inspectionResults)
        .where(
          and(
            eq(inspectionResults.workOrderId, params.id),
            eq(inspectionResults.resultPassFail, "fail"),
          ),
        );

      if (failedInspections.length === 0) {
        return NextResponse.json(
          { error: "Inga underkända inspektionspunkter hittades. Lägg till punkter manuellt." },
          { status: 400 },
        );
      }

      bodyItems = failedInspections.map((ir) => ({
        description: `${ir.sectionTitle}: ${ir.itemLabel}${ir.resultNote ? ` — ${ir.resultNote}` : ""}`,
        inspectionResultId: ir.id,
        photoUrls: ir.photoUrls ?? [],
      }));
    }

    // Create approval request with real JWT token atomically
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Use a random placeholder, then immediately replace with real JWT in a transaction
    const { approvalRequest, token } = await db.transaction(async (tx) => {
      const [ar] = await tx
        .insert(approvalRequests)
        .values({
          workOrderId: params.id,
          token: crypto.randomUUID(), // safe placeholder (not guessable)
          expiresAt,
        })
        .returning();

      const jwt = await signApprovalToken(ar.id);

      await tx
        .update(approvalRequests)
        .set({ token: jwt })
        .where(eq(approvalRequests.id, ar.id));

      if (bodyItems.length > 0) {
        await tx.insert(approvalItems).values(
          bodyItems.map((item, i) => ({
            approvalRequestId: ar.id,
            inspectionResultId: item.inspectionResultId ?? null,
            description: item.description,
            estimatedCost: item.estimatedCost?.toString() ?? null,
            photoUrls: item.photoUrls ?? [],
            sortOrder: i,
          })),
        );
      }

      return { approvalRequest: ar, token: jwt };
    });

    // Build public URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const publicUrl = `${appUrl}/godkann/${token}`;

    return NextResponse.json({
      success: true,
      approvalRequestId: approvalRequest.id,
      token,
      publicUrl,
      itemCount: bodyItems.length,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: any) {
    console.error("[arbetsorder/approval] Error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte skapa godkännandeförfrågan." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/arbetsorder/[id]/approval
 * Returns existing approval requests for a work order. Auth required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const requests = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.workOrderId, params.id));

    return NextResponse.json({ data: requests });
  } catch (err: any) {
    console.error("[arbetsorder/approval] GET error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte hämta godkännanden." },
      { status: 500 },
    );
  }
}

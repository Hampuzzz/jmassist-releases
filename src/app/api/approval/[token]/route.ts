import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  approvalRequests, approvalItems,
  workOrders, vehicles, customers,
} from "@/lib/db/schemas";
import { eq, and, asc } from "drizzle-orm";
import { verifyApprovalToken } from "@/lib/approval/tokens";

/**
 * GET /api/approval/[token]
 * Public endpoint — fetches approval request details for customer view.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    // Verify JWT
    const approvalRequestId = await verifyApprovalToken(params.token);
    if (!approvalRequestId) {
      return NextResponse.json(
        { error: "Ogiltig eller utgången länk." },
        { status: 401 },
      );
    }

    // Fetch approval request
    const [request] = await db
      .select({
        id:              approvalRequests.id,
        status:          approvalRequests.status,
        customerMessage: approvalRequests.customerMessage,
        respondedAt:     approvalRequests.respondedAt,
        expiresAt:       approvalRequests.expiresAt,
        createdAt:       approvalRequests.createdAt,
        // Work order
        orderNumber:     workOrders.orderNumber,
        // Vehicle
        vehicleRegNr:    vehicles.regNr,
        vehicleBrand:    vehicles.brand,
        vehicleModel:    vehicles.model,
        vehicleYear:     vehicles.modelYear,
        // Customer
        customerFirst:   customers.firstName,
        customerLast:    customers.lastName,
        customerCompany: customers.companyName,
      })
      .from(approvalRequests)
      .innerJoin(workOrders, eq(approvalRequests.workOrderId, workOrders.id))
      .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
      .innerJoin(customers, eq(workOrders.customerId, customers.id))
      .where(eq(approvalRequests.id, approvalRequestId));

    if (!request) {
      return NextResponse.json(
        { error: "Godkännande hittades inte." },
        { status: 404 },
      );
    }

    // Check expiry
    if (new Date(request.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Denna godkännandelänk har gått ut." },
        { status: 410 },
      );
    }

    // Fetch items
    const items = await db
      .select()
      .from(approvalItems)
      .where(eq(approvalItems.approvalRequestId, approvalRequestId))
      .orderBy(asc(approvalItems.sortOrder));

    const workshopName = process.env.WORKSHOP_NAME ?? process.env.NEXT_PUBLIC_APP_NAME ?? "Verkstaden";

    return NextResponse.json({
      data: {
        ...request,
        workshopName,
        items: items.map((item) => ({
          id: item.id,
          description: item.description,
          estimatedCost: item.estimatedCost,
          photoUrls: item.photoUrls ?? [],
          approved: item.approved,
          customerNote: item.customerNote,
          sortOrder: item.sortOrder,
        })),
      },
    });
  } catch (err: any) {
    console.error("[approval/token] GET error:", err);
    return NextResponse.json(
      { error: "Kunde inte hämta godkännande." },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/approval/[token]
 * Public endpoint — customer submits their approval decisions.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    // Verify JWT
    const approvalRequestId = await verifyApprovalToken(params.token);
    if (!approvalRequestId) {
      return NextResponse.json(
        { error: "Ogiltig eller utgången länk." },
        { status: 401 },
      );
    }

    // Fetch approval request
    const [approvalRequest] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalRequestId));

    if (!approvalRequest) {
      return NextResponse.json(
        { error: "Godkännande hittades inte." },
        { status: 404 },
      );
    }

    // Check expiry
    if (new Date(approvalRequest.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Denna godkännandelänk har gått ut." },
        { status: 410 },
      );
    }

    // Check if already responded
    if (approvalRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Detta godkännande har redan besvarats." },
        { status: 409 },
      );
    }

    // Parse body
    const body = await request.json();
    const { items, message } = body as {
      items: Array<{ id: string; approved: boolean; customerNote?: string }>;
      message?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Inga beslut skickades." },
        { status: 400 },
      );
    }

    // Determine overall status
    const allApproved = items.every((i) => i.approved);
    const allDenied = items.every((i) => !i.approved);
    const overallStatus = allApproved
      ? "approved"
      : allDenied
      ? "denied"
      : "partially_approved";

    // Update items + request atomically
    await db.transaction(async (tx) => {
      for (const decision of items) {
        await tx
          .update(approvalItems)
          .set({
            approved: decision.approved,
            customerNote: decision.customerNote ?? null,
          })
          .where(
            and(
              eq(approvalItems.id, decision.id),
              eq(approvalItems.approvalRequestId, approvalRequestId),
            ),
          );
      }

      await tx
        .update(approvalRequests)
        .set({
          status: overallStatus,
          customerMessage: message ?? null,
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvalRequests.id, approvalRequestId));
    });

    return NextResponse.json({
      success: true,
      status: overallStatus,
    });
  } catch (err: any) {
    console.error("[approval/token] PATCH error:", err);
    return NextResponse.json(
      { error: "Kunde inte spara beslut." },
      { status: 500 },
    );
  }
}

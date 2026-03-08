import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  workOrders, workOrderTasks, workOrderParts,
  vehicles, customers, parts, approvalRequests,
  vehicleHealthChecks, vhcItems,
} from "@/lib/db/schemas";
import { eq, asc, desc, and, sql } from "drizzle-orm";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { WORK_ORDER_STATUSES, VALID_STATUS_TRANSITIONS, WORKSHOP_HOURLY_RATE } from "@/lib/constants";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { WorkOrderDetail } from "@/components/arbetsorder/WorkOrderDetail";
import { LineItemsSection } from "@/components/arbetsorder/LineItemsSection";
import { AiDiagnosisButton } from "@/components/arbetsorder/AiDiagnosisButton";
import { GenerateInvoiceButton } from "@/components/arbetsorder/GenerateInvoiceButton";
import { QuickVideoButton } from "@/components/arbetsorder/QuickVideoButton";

export const dynamic = "force-dynamic";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Fetch work order with joins
  let order: any = null;
  let tasks: any[] = [];
  let partsUsed: any[] = [];
  let approvals: any[] = [];
  let vhcData: { id: string; yellowCount: number; redCount: number; status: string } | null = null;

  try {
    const [result] = await db
      .select({
        id:                workOrders.id,
        orderNumber:       workOrders.orderNumber,
        status:            workOrders.status,
        receivedAt:        workOrders.receivedAt,
        promisedAt:        workOrders.promisedAt,
        startedAt:         workOrders.startedAt,
        finishedAt:        workOrders.finishedAt,
        mileageIn:         workOrders.mileageIn,
        mileageOut:        workOrders.mileageOut,
        customerComplaint: workOrders.customerComplaint,
        internalNotes:     workOrders.internalNotes,
        laborRateOverride: workOrders.laborRateOverride,
        vehicleId:         vehicles.id,
        vehicleRegNr:      vehicles.regNr,
        vehicleBrand:      vehicles.brand,
        vehicleModel:      vehicles.model,
        vehicleYear:       vehicles.modelYear,
        customerId:        customers.id,
        customerFirst:     customers.firstName,
        customerLast:      customers.lastName,
        customerCo:        customers.companyName,
        customerPhone:     customers.phone,
        customerEmail:     customers.email,
        invoiceId:         workOrders.invoiceId,
      })
      .from(workOrders)
      .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
      .innerJoin(customers, eq(workOrders.customerId, customers.id))
      .where(eq(workOrders.id, params.id));

    order = result;

    if (order) {
      // Fetch tasks
      tasks = await db
        .select()
        .from(workOrderTasks)
        .where(eq(workOrderTasks.workOrderId, params.id))
        .orderBy(asc(workOrderTasks.sortOrder));

      // Fetch parts used
      partsUsed = await db
        .select({
          id:            workOrderParts.id,
          partId:        workOrderParts.partId,
          quantity:      workOrderParts.quantity,
          unitCostPrice: workOrderParts.unitCostPrice,
          unitSellPrice: workOrderParts.unitSellPrice,
          vmbEligible:   workOrderParts.vmbEligible,
          costBasis:     workOrderParts.costBasis,
          notes:         workOrderParts.notes,
          partName:      parts.name,
          partNumber:    parts.partNumber,
        })
        .from(workOrderParts)
        .innerJoin(parts, eq(workOrderParts.partId, parts.id))
        .where(eq(workOrderParts.workOrderId, params.id));

      // Fetch approval requests
      approvals = await db
        .select({
          id:        approvalRequests.id,
          status:    approvalRequests.status,
          token:     approvalRequests.token,
          expiresAt: approvalRequests.expiresAt,
        })
        .from(approvalRequests)
        .where(eq(approvalRequests.workOrderId, params.id))
        .orderBy(desc(approvalRequests.createdAt));

      // Fetch VHC status if exists
      const [existingVhc] = await db
        .select({
          id:     vehicleHealthChecks.id,
          status: vehicleHealthChecks.status,
        })
        .from(vehicleHealthChecks)
        .where(eq(vehicleHealthChecks.workOrderId, params.id))
        .limit(1);

      if (existingVhc) {
        // Count yellow and red items
        const [counts] = await db
          .select({
            yellowCount: sql<number>`count(*) filter (where ${vhcItems.severity} = 'yellow')`,
            redCount:    sql<number>`count(*) filter (where ${vhcItems.severity} = 'red')`,
          })
          .from(vhcItems)
          .where(eq(vhcItems.checkId, existingVhc.id));

        vhcData = {
          id: existingVhc.id,
          status: existingVhc.status,
          yellowCount: Number(counts?.yellowCount ?? 0),
          redCount: Number(counts?.redCount ?? 0),
        };
      }
    }
  } catch (err) {
    console.error("[arbetsorder/id] DB query failed:", err);
  }

  if (!order) notFound();

  // Calculate totals
  const hourlyRate = order.laborRateOverride
    ? parseFloat(order.laborRateOverride)
    : WORKSHOP_HOURLY_RATE;

  const totalLaborHours = tasks.reduce(
    (sum, t) => sum + (t.actualHours ? parseFloat(t.actualHours) : (t.estimatedHours ? parseFloat(t.estimatedHours) : 0)),
    0,
  );
  const laborTotal = totalLaborHours * hourlyRate;

  const partsTotal = partsUsed.reduce(
    (sum, p) => sum + parseFloat(p.quantity) * parseFloat(p.unitSellPrice),
    0,
  );

  const partsCost = partsUsed.reduce(
    (sum, p) => sum + parseFloat(p.quantity) * parseFloat(p.unitCostPrice),
    0,
  );

  const subtotal = laborTotal + partsTotal;
  const vatAmount = subtotal * 0.25;
  const total = subtotal + vatAmount;
  const partsMargin = partsTotal - partsCost;

  const statusConfig = WORK_ORDER_STATUSES[order.status as keyof typeof WORK_ORDER_STATUSES]
    ?? { label: order.status, color: "bg-zinc-700 text-zinc-200" };
  const allowedTransitions = VALID_STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/arbetsorder"
            className="p-2 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-workshop-text">
                {order.orderNumber || "Ny order"}
              </h1>
            </div>
            <p className="text-workshop-muted text-sm">
              Mottagen {formatDateTime(order.receivedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Status transition buttons — optimistic UI */}
      <WorkOrderDetail
        orderId={order.id}
        initialStatus={order.status}
        initialAllowedTransitions={allowedTransitions}
        approvalRequests={approvals.map((a: any) => ({
          id: a.id,
          status: a.status,
          token: a.token,
          expiresAt: a.expiresAt?.toISOString?.() ?? a.expiresAt,
        }))}
      />

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vehicle card */}
        <div className="surface p-4 space-y-2">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Fordon</h3>
          <div className="flex items-center gap-3">
            <span className="reg-plate">{order.vehicleRegNr}</span>
            <div>
              <p className="font-medium text-workshop-text">
                {order.vehicleBrand} {order.vehicleModel}
                {order.vehicleYear ? ` (${order.vehicleYear})` : ""}
              </p>
              {order.mileageIn && (
                <p className="text-xs text-workshop-muted">
                  Mätare in: {order.mileageIn.toLocaleString("sv-SE")} km
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Customer card */}
        <div className="surface p-4 space-y-2">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Kund</h3>
          <p className="font-medium text-workshop-text">
            {order.customerCo ?? `${order.customerFirst ?? ""} ${order.customerLast ?? ""}`}
          </p>
          {order.customerPhone && (
            <p className="text-sm text-workshop-muted">
              <a href={`tel:${order.customerPhone}`} className="hover:text-workshop-accent">
                {order.customerPhone}
              </a>
            </p>
          )}
          {order.customerEmail && (
            <p className="text-sm text-workshop-muted">{order.customerEmail}</p>
          )}
        </div>
      </div>

      {/* Complaint */}
      {order.customerComplaint && (
        <div className="surface p-4">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-2">
            Felbeskrivning
          </h3>
          <p className="text-workshop-text whitespace-pre-wrap">{order.customerComplaint}</p>
        </div>
      )}

      {/* Quick Actions — VHC + AI */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/arbetsorder/${order.id}/vhc`}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-900/30 hover:bg-teal-900/50 text-teal-400 rounded-md text-sm font-medium transition-colors"
        >
          <Stethoscope className="h-4 w-4" />
          Hälsokontroll
          {vhcData && (vhcData.yellowCount > 0 || vhcData.redCount > 0) && (
            <span className="flex items-center gap-1 ml-1">
              {vhcData.redCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {vhcData.redCount}
                </span>
              )}
              {vhcData.yellowCount > 0 && (
                <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {vhcData.yellowCount}
                </span>
              )}
            </span>
          )}
          {vhcData && !vhcData.yellowCount && !vhcData.redCount && (
            <span className="text-[10px] bg-teal-900/50 px-1.5 py-0.5 rounded text-teal-300">
              {vhcData.status === "sent" ? "Skickad" : vhcData.status === "approved" ? "Godkänd" : "Utkast"}
            </span>
          )}
        </Link>

        <QuickVideoButton
          workOrderId={order.id}
          vehicleRegNr={order.vehicleRegNr}
          customerPhone={order.customerPhone ?? null}
          customerName={
            order.customerCo
              ?? ([order.customerFirst, order.customerLast].filter(Boolean).join(" ") || "Kund")
          }
        />

        <AiDiagnosisButton
          vehicleId={order.vehicleId}
          vehicleMake={order.vehicleBrand}
          vehicleModel={order.vehicleModel}
          vehicleYear={order.vehicleYear}
        />

        <GenerateInvoiceButton
          workOrderId={order.id}
          invoiceId={order.invoiceId}
        />
      </div>

      {/* Line Items */}
      <LineItemsSection
        orderId={order.id}
        tasks={tasks.map((t) => ({
          id: t.id,
          description: t.description,
          estimatedHours: t.estimatedHours ? parseFloat(t.estimatedHours) : null,
          actualHours: t.actualHours ? parseFloat(t.actualHours) : null,
          isCompleted: t.isCompleted,
        }))}
        partsUsed={partsUsed.map((p) => ({
          id: p.id,
          partId: p.partId,
          partName: p.partName,
          partNumber: p.partNumber,
          quantity: parseFloat(p.quantity),
          unitCostPrice: parseFloat(p.unitCostPrice),
          unitSellPrice: parseFloat(p.unitSellPrice),
          vmbEligible: p.vmbEligible,
          costBasis: p.costBasis ? parseFloat(p.costBasis) : null,
          notes: p.notes,
        }))}
        hourlyRate={hourlyRate}
      />

      {/* Financial Summary */}
      <div className="surface p-4 space-y-3">
        <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">
          Ekonomisk sammanfattning
        </h3>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-workshop-muted">
              Arbete ({totalLaborHours.toFixed(1)} tim &times; {formatCurrency(hourlyRate)})
            </span>
            <span className="text-workshop-text">{formatCurrency(laborTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-workshop-muted">Material ({partsUsed.length} artiklar)</span>
            <span className="text-workshop-text">{formatCurrency(partsTotal)}</span>
          </div>
          <div className="border-t border-workshop-border pt-1.5 flex justify-between text-sm">
            <span className="text-workshop-muted">Summa exkl. moms</span>
            <span className="text-workshop-text font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-workshop-muted">Moms 25%</span>
            <span className="text-workshop-text">{formatCurrency(vatAmount)}</span>
          </div>
          <div className="border-t border-workshop-border pt-1.5 flex justify-between">
            <span className="text-workshop-text font-bold">Totalt inkl. moms</span>
            <span className="text-workshop-accent text-lg font-bold">{formatCurrency(total)}</span>
          </div>
        </div>
        <div className="pt-2 border-t border-dashed border-workshop-border">
          <div className="flex justify-between text-xs text-workshop-muted">
            <span>Materialkostnad (inköp)</span>
            <span>{formatCurrency(partsCost)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-workshop-muted">Materialmarginal</span>
            <span className="text-green-400">{formatCurrency(partsMargin)}</span>
          </div>
        </div>
      </div>

      {/* Internal notes */}
      {order.internalNotes && (
        <div className="surface p-4 border-l-4 border-amber-600">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-2">
            Interna anteckningar
          </h3>
          <p className="text-workshop-text text-sm whitespace-pre-wrap">{order.internalNotes}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="surface p-4">
        <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-2">Tider</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-workshop-muted text-xs">Mottagen</p>
            <p className="text-workshop-text">{formatDateTime(order.receivedAt)}</p>
          </div>
          {order.startedAt && (
            <div>
              <p className="text-workshop-muted text-xs">Startad</p>
              <p className="text-workshop-text">{formatDateTime(order.startedAt)}</p>
            </div>
          )}
          {order.promisedAt && (
            <div>
              <p className="text-workshop-muted text-xs">Utlovad</p>
              <p className="text-amber-400">{formatDate(order.promisedAt)}</p>
            </div>
          )}
          {order.finishedAt && (
            <div>
              <p className="text-workshop-muted text-xs">Avslutad</p>
              <p className="text-green-400">{formatDateTime(order.finishedAt)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

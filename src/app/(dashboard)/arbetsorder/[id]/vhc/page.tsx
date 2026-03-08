import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { db } from "@/lib/db";
import { vehicleHealthChecks, vhcItems, workOrders, vehicles, customers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { VhcChecklist } from "@/components/vhc/VhcChecklist";
import { VHC_CATEGORIES } from "@/lib/vhc/default-checklist";
import type { VhcItemState } from "@/components/vhc/VhcItemRow";

interface Props {
  params: { id: string }; // work order ID
}

export default async function VhcPage({ params }: Props) {
  const workOrderId = params.id;

  // Get work order
  const [wo] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId));

  if (!wo) redirect("/arbetsorder");

  // Get or check existing VHC
  let vhcList = await db
    .select()
    .from(vehicleHealthChecks)
    .where(eq(vehicleHealthChecks.workOrderId, workOrderId));

  // If no VHC exists yet, we show a "create" prompt
  const vhc = vhcList[0] ?? null;

  // Get vehicle info
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, wo.vehicleId));

  // Get customer phone
  let customerPhone: string | undefined;
  if (vehicle?.customerId) {
    const [customer] = await db
      .select({ phone: customers.phone })
      .from(customers)
      .where(eq(customers.id, vehicle.customerId));
    customerPhone = customer?.phone ?? undefined;
  }

  // Get VHC items if VHC exists
  let items: VhcItemState[] = [];
  if (vhc) {
    const rawItems = await db
      .select()
      .from(vhcItems)
      .where(eq(vhcItems.checkId, vhc.id))
      .orderBy(vhcItems.sortOrder);

    items = rawItems.map((item) => ({
      id: item.id,
      category: item.category,
      label: item.label,
      severity: (item.severity as "green" | "yellow" | "red") ?? "green",
      comment: item.comment ?? "",
      estimatedCost: item.estimatedCost ?? "",
      mediaUrls: item.mediaUrls ?? [],
    }));
  }

  return (
    <div className="min-h-screen bg-workshop-dark">
      {/* Header */}
      <div className="bg-workshop-card border-b border-workshop-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/arbetsorder/${workOrderId}`}
            className="p-2 rounded-lg hover:bg-workshop-border transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-workshop-muted" />
          </Link>
          <Stethoscope className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-lg font-bold text-workshop-text">Hälsokontroll</h1>
            <p className="text-xs text-workshop-muted">
              {vehicle?.regNr ?? "—"} • {vehicle?.brand} {vehicle?.model} {vehicle?.modelYear ?? ""} • Order {wo.orderNumber}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {vhc ? (
        <VhcChecklist
          vhcId={vhc.id}
          workOrderId={workOrderId}
          initialItems={items}
          initialStatus={vhc.status}
          customerPhone={customerPhone}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Stethoscope className="w-16 h-16 text-workshop-muted" />
          <h2 className="text-xl font-semibold text-workshop-text">Ingen hälsokontroll skapad</h2>
          <p className="text-workshop-muted text-center max-w-md">
            Skapa en hälsokontroll för denna arbetsorder. En standardchecklista med {37} kontrollpunkter genereras automatiskt.
          </p>
          <CreateVhcButton workOrderId={workOrderId} vehicleId={wo.vehicleId} />
        </div>
      )}
    </div>
  );
}

function CreateVhcButton({ workOrderId, vehicleId }: { workOrderId: string; vehicleId: string }) {
  return (
    <form
      action={async () => {
        "use server";

        // Check if VHC already exists
        const existing = await db
          .select({ id: vehicleHealthChecks.id })
          .from(vehicleHealthChecks)
          .where(eq(vehicleHealthChecks.workOrderId, workOrderId));

        if (existing.length > 0) {
          // Already exists, just redirect
          redirect(`/arbetsorder/${workOrderId}/vhc`);
        }

        // Create VHC with unique public token
        const publicToken = randomUUID();
        const [vhc] = await db
          .insert(vehicleHealthChecks)
          .values({
            workOrderId,
            vehicleId,
            publicToken,
            status: "draft",
          })
          .returning();

        // Generate default checklist items
        let sortOrder = 0;
        const items = VHC_CATEGORIES.flatMap((cat) =>
          cat.items.map((label) => ({
            checkId: vhc.id,
            category: cat.key,
            label,
            severity: "green" as const,
            sortOrder: sortOrder++,
          })),
        );

        await db.insert(vhcItems).values(items);

        redirect(`/arbetsorder/${workOrderId}/vhc`);
      }}
    >
      <button
        type="submit"
        className="px-8 py-4 rounded-xl bg-blue-600 text-white font-semibold text-lg hover:bg-blue-500 transition-colors touch-manipulation shadow-lg"
      >
        🩺 Skapa hälsokontroll
      </button>
    </form>
  );
}

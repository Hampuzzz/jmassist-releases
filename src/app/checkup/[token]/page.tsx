import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { vehicleHealthChecks, vhcItems, vehicles } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { CheckupClient } from "./CheckupClient";

interface Props {
  params: { token: string };
}

export default async function CheckupPage({ params }: Props) {
  // Find VHC by public token
  const [vhc] = await db
    .select()
    .from(vehicleHealthChecks)
    .where(eq(vehicleHealthChecks.publicToken, params.token));

  if (!vhc) notFound();

  // Get items
  const items = await db
    .select()
    .from(vhcItems)
    .where(eq(vhcItems.checkId, vhc.id))
    .orderBy(vhcItems.sortOrder);

  // Get vehicle
  const [vehicle] = await db
    .select({
      regNr: vehicles.regNr,
      brand: vehicles.brand,
      model: vehicles.model,
      modelYear: vehicles.modelYear,
    })
    .from(vehicles)
    .where(eq(vehicles.id, vhc.vehicleId));

  return (
    <CheckupClient
      vhcId={vhc.id}
      token={params.token}
      status={vhc.status}
      createdAt={vhc.createdAt.toISOString()}
      vehicle={vehicle ?? { regNr: "—", brand: "", model: "", modelYear: null }}
      items={items.map((i) => ({
        id: i.id,
        category: i.category,
        label: i.label,
        severity: i.severity as "green" | "yellow" | "red",
        comment: i.comment ?? "",
        estimatedCost: i.estimatedCost ?? "",
        customerApproved: i.customerApproved ?? false,
        mediaUrls: i.mediaUrls ?? [],
      }))}
    />
  );
}

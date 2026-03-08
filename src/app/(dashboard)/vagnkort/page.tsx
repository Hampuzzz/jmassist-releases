import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { vehicles, customers } from "@/lib/db/schemas";
import { eq, desc, ilike } from "drizzle-orm";
import DeleteButton from "@/components/DeleteButton";
import { Pagination } from "@/components/ui/Pagination";
import { EnrichStatus } from "@/components/vagnkort/EnrichStatus";

export const metadata = { title: "Vagnkort" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function VagnkortPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const search = searchParams.q;
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));

  let data: any[] = [];
  try {
    data = await db
      .select({
        id:           vehicles.id,
        regNr:        vehicles.regNr,
        brand:        vehicles.brand,
        model:        vehicles.model,
        modelYear:    vehicles.modelYear,
        color:        vehicles.color,
        fuelType:     vehicles.fuelType,
        mileageKm:    vehicles.mileageKm,
        customerName: customers.firstName,
        customerLast: customers.lastName,
        customerCo:   customers.companyName,
      })
      .from(vehicles)
      .leftJoin(customers, eq(vehicles.customerId, customers.id))
      .where(
        search
          ? ilike(vehicles.regNr, `%${search}%`)
          : undefined,
      )
      .orderBy(desc(vehicles.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE);
  } catch (err) {
    console.error("[vagnkort] DB query failed:", err);
  }

  const hasMore = data.length > PAGE_SIZE;
  if (hasMore) data = data.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-workshop-text">Vagnkort</h1>
        <Link
          href="/vagnkort/ny"
          className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Registrera fordon
        </Link>
      </div>

      {/* Vehicle enrichment status */}
      <EnrichStatus />

      {/* Search */}
      <form className="flex gap-2" method="get">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-workshop-muted" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Sök regnummer..."
            className="w-full pl-9 pr-3 py-2 bg-workshop-elevated border border-workshop-border
                       rounded-md text-workshop-text placeholder-workshop-muted text-sm
                       focus:outline-none focus:ring-2 focus:ring-workshop-accent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-text hover:bg-workshop-elevated"
        >
          Sök
        </button>
      </form>

      {/* Vehicle table */}
      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-border bg-workshop-elevated">
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Regnr</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Fordon</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">År</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden lg:table-cell">Ägare</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden lg:table-cell">Miltal</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase w-12"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((v) => (
              <tr
                key={v.id}
                className="border-b border-workshop-border hover:bg-workshop-elevated/50 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <Link href={`/vagnkort/${v.id}`}>
                    <span className="reg-plate">{v.regNr}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/vagnkort/${v.id}`} className="hover:text-workshop-accent">
                    <p className="font-medium text-workshop-text">{v.brand} {v.model}</p>
                    <p className="text-xs text-workshop-muted capitalize">{v.fuelType ?? "–"}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-workshop-muted hidden md:table-cell">{v.modelYear ?? "–"}</td>
                <td className="px-4 py-3 text-workshop-muted hidden lg:table-cell">
                  {v.customerCo ?? (`${v.customerName ?? ""} ${v.customerLast ?? ""}`.trim() || "–")}
                </td>
                <td className="px-4 py-3 text-workshop-muted hidden lg:table-cell">
                  {v.mileageKm ? `${v.mileageKm.toLocaleString("sv-SE")} km` : "–"}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton
                    id={v.id}
                    endpoint="/api/vagnkort"
                    confirmMessage="Är du säker på att du vill ta bort detta fordon?"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <p className="text-center text-workshop-muted py-8 text-sm">Inga fordon hittades</p>
        )}
      </div>

      <Pagination
        currentPage={page}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        baseUrl="/vagnkort"
        searchParams={search ? { q: search } : {}}
      />
    </div>
  );
}

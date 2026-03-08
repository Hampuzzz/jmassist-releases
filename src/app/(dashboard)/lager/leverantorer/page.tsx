import Link from "next/link";
import { Plus, Truck, Package } from "lucide-react";
import { db } from "@/lib/db";
import { suppliers } from "@/lib/db/schemas";
import { desc, ilike, or, sql } from "drizzle-orm";
import DeleteButton from "@/components/DeleteButton";

export const metadata = { title: "Leverantörer" };
export const dynamic = "force-dynamic";

export default async function LeverantorerPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const search = searchParams.q;

  let data: any[] = [];
  try {
    data = await db
      .select({
        id:                  suppliers.id,
        name:                suppliers.name,
        orgNr:               suppliers.orgNr,
        contactName:         suppliers.contactName,
        email:               suppliers.email,
        phone:               suppliers.phone,
        city:                suppliers.city,
        integrationType:     suppliers.integrationType,
        defaultLeadTimeDays: suppliers.defaultLeadTimeDays,
        isActive:            suppliers.isActive,
        partCount:           sql<number>`(SELECT count(*) FROM parts WHERE parts.supplier_id = ${suppliers.id})`,
      })
      .from(suppliers)
      .where(
        search
          ? or(
              ilike(suppliers.name, `%${search}%`),
              ilike(suppliers.contactName, `%${search}%`),
              ilike(suppliers.email, `%${search}%`),
              ilike(suppliers.phone, `%${search}%`),
            )
          : undefined,
      )
      .orderBy(desc(suppliers.createdAt));
  } catch (err) {
    console.error("[leverantorer] DB query failed:", err);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Leverantörer</h1>
          <p className="text-workshop-muted text-sm">{data.length} leverantörer</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/lager"
            className="px-3 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-text hover:bg-workshop-elevated"
          >
            Tillbaka till lager
          </Link>
          <Link
            href="/lager/leverantorer/ny"
            className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Ny leverantör
          </Link>
        </div>
      </div>

      {/* Search */}
      <form className="flex gap-2" method="get">
        <input
          name="q"
          defaultValue={search}
          placeholder="Sök namn, kontakt, e-post, telefon..."
          className="flex-1 max-w-sm px-3 py-2 bg-workshop-elevated border border-workshop-border
                     rounded-md text-workshop-text placeholder-workshop-muted text-sm
                     focus:outline-none focus:ring-2 focus:ring-workshop-accent"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-text hover:bg-workshop-elevated"
        >
          Sök
        </button>
      </form>

      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-border bg-workshop-elevated">
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Namn</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Kontaktperson</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Telefon</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden lg:table-cell">E-post</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden lg:table-cell">Ort</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-workshop-muted uppercase">Artiklar</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase w-12"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="border-b border-workshop-border hover:bg-workshop-elevated/50">
                <td className="px-4 py-3">
                  <Link href={`/lager/leverantorer/${s.id}`} className="hover:text-workshop-accent">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-workshop-muted shrink-0" />
                      <div>
                        <p className="font-medium text-workshop-text">{s.name}</p>
                        {s.orgNr && <p className="text-xs text-workshop-muted">{s.orgNr}</p>}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-workshop-muted hidden md:table-cell">{s.contactName ?? "–"}</td>
                <td className="px-4 py-3 text-workshop-muted hidden md:table-cell">{s.phone ?? "–"}</td>
                <td className="px-4 py-3 text-workshop-muted hidden lg:table-cell">{s.email ?? "–"}</td>
                <td className="px-4 py-3 text-workshop-muted hidden lg:table-cell">{s.city ?? "–"}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-xs text-workshop-muted">
                    <Package className="h-3 w-3" />
                    {Number(s.partCount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton
                    id={s.id}
                    endpoint="/api/leverantorer"
                    confirmMessage="Är du säker på att du vill ta bort denna leverantör? Artiklar kopplade till leverantören behålls men tappar kopplingen."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 text-workshop-muted mx-auto mb-4" />
            <h3 className="text-lg text-workshop-text font-medium mb-2">Inga leverantörer</h3>
            <p className="text-workshop-muted mb-4 text-sm">
              {search ? "Inga leverantörer matchar sökningen." : "Lägg till din första leverantör."}
            </p>
            {!search && (
              <Link
                href="/lager/leverantorer/ny"
                className="inline-flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Ny leverantör
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

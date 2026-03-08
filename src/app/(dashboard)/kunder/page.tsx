import Link from "next/link";
import { Plus, Building2, User } from "lucide-react";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schemas";
import { desc, ilike, or } from "drizzle-orm";
import DeleteButton from "@/components/DeleteButton";
import { Pagination } from "@/components/ui/Pagination";
import { ImportButton } from "@/components/kunder/ImportButton";

export const metadata = { title: "Kunder" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function KunderPage({
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
        id:          customers.id,
        firstName:   customers.firstName,
        lastName:    customers.lastName,
        companyName: customers.companyName,
        email:       customers.email,
        phone:       customers.phone,
        isCompany:   customers.isCompany,
        city:        customers.city,
        orgNr:       customers.orgNr,
      })
      .from(customers)
      .where(
        search
          ? or(
              ilike(customers.firstName,   `%${search}%`),
              ilike(customers.lastName,    `%${search}%`),
              ilike(customers.companyName, `%${search}%`),
              ilike(customers.email,       `%${search}%`),
              ilike(customers.phone,       `%${search}%`),
            )
          : undefined,
      )
      .orderBy(desc(customers.createdAt))
      .limit(PAGE_SIZE + 1) // Fetch 1 extra to detect hasMore
      .offset((page - 1) * PAGE_SIZE);
  } catch (err) {
    console.error("[kunder] DB query failed:", err);
  }

  const hasMore = data.length > PAGE_SIZE;
  if (hasMore) data = data.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-workshop-text">Kunder</h1>
        <div className="flex items-center gap-2">
          <ImportButton />
          <Link
            href="/kunder/ny"
            className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Ny kund
          </Link>
        </div>
      </div>

      {/* Search */}
      <form className="flex gap-2" method="get">
        <input
          name="q"
          defaultValue={search}
          placeholder="Sök namn, e-post, telefon..."
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
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Typ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Namn / Företag</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Telefon</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden lg:table-cell">E-post</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden lg:table-cell">Ort</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase w-12"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-b border-workshop-border hover:bg-workshop-elevated/50">
                <td className="px-4 py-3">
                  {c.isCompany
                    ? <Building2 className="h-4 w-4 text-blue-400" />
                    : <User className="h-4 w-4 text-workshop-muted" />}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/kunder/${c.id}`} className="hover:text-workshop-accent">
                    <p className="font-medium text-workshop-text">
                      {c.isCompany
                        ? c.companyName
                        : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}
                    </p>
                    {c.isCompany && c.orgNr && (
                      <p className="text-xs text-workshop-muted">{c.orgNr}</p>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3 text-workshop-muted hidden md:table-cell">{c.phone ?? "–"}</td>
                <td className="px-4 py-3 text-workshop-muted hidden lg:table-cell">{c.email ?? "–"}</td>
                <td className="px-4 py-3 text-workshop-muted hidden lg:table-cell">{c.city ?? "–"}</td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton
                    id={c.id}
                    endpoint="/api/kunder"
                    confirmMessage="Är du säker på att du vill ta bort denna kund?"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <p className="text-center text-workshop-muted py-8 text-sm">Inga kunder hittades</p>
        )}
      </div>

      <Pagination
        currentPage={page}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        baseUrl="/kunder"
        searchParams={search ? { q: search } : {}}
      />
    </div>
  );
}

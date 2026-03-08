import Link from "next/link";
import { Plus, AlertTriangle, ShoppingCart } from "lucide-react";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schemas";
import { eq, desc, ilike } from "drizzle-orm";
import { Pagination } from "@/components/ui/Pagination";
import { LagerTable } from "@/components/lager/LagerTable";

export const metadata = { title: "Lager" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function LagerPage({
  searchParams,
}: {
  searchParams: { q?: string; low_stock?: string; page?: string };
}) {
  const search   = searchParams.q;
  const lowStock = searchParams.low_stock === "true";
  const page     = Math.max(1, parseInt(searchParams.page ?? "1"));

  let data: any[] = [];
  try {
    data = await db
      .select({
        id:            parts.id,
        partNumber:    parts.partNumber,
        name:          parts.name,
        category:      parts.category,
        costPrice:     parts.costPrice,
        sellPrice:     parts.sellPrice,
        stockQty:      parts.stockQty,
        stockMinQty:   parts.stockMinQty,
        stockLocation: parts.stockLocation,
        markupPct:     parts.markupPct,
        unit:          parts.unit,
      })
      .from(parts)
      .where(
        search
          ? ilike(parts.name, `%${search}%`)
          : eq(parts.isActive, true),
      )
      .orderBy(desc(parts.updatedAt))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE);

    if (lowStock) {
      data = data.filter(
        (p) => parseFloat(p.stockQty) <= parseFloat(p.stockMinQty),
      );
    }
  } catch (err) {
    console.error("[lager] DB query failed:", err);
  }

  const hasMore = data.length > PAGE_SIZE;
  if (hasMore) data = data.slice(0, PAGE_SIZE);

  const paginationParams: Record<string, string> = {};
  if (search) paginationParams.q = search;
  if (lowStock) paginationParams.low_stock = "true";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-workshop-text">Lager</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/lager/inkop"
            className="flex items-center gap-2 px-3 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-text hover:bg-workshop-elevated"
          >
            <ShoppingCart className="h-4 w-4" />
            Inköp
          </Link>
          <Link
            href="/lager/leverantorer"
            className="px-3 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-text hover:bg-workshop-elevated"
          >
            Leverantörer
          </Link>
          <Link
            href="/lager/ny"
            className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Ny artikel
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <form className="flex gap-2" method="get">
          <input
            name="q"
            defaultValue={search}
            placeholder="Sök artiklar..."
            className="px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-md
                       text-workshop-text placeholder-workshop-muted text-sm w-48
                       focus:outline-none focus:ring-2 focus:ring-workshop-accent"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm hover:bg-workshop-elevated text-workshop-text"
          >
            Sök
          </button>
        </form>

        <Link
          href={lowStock ? "/lager" : "/lager?low_stock=true"}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border ${
            lowStock
              ? "border-red-700 bg-red-900/30 text-red-300"
              : "border-workshop-border bg-workshop-surface text-workshop-muted hover:bg-workshop-elevated"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Låg lagernivå
        </Link>

        <span className="text-xs text-workshop-muted ml-2">
          💡 Klicka på saldo/pris för att redigera
        </span>
      </div>

      <LagerTable data={data} />

      <Pagination
        currentPage={page}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        baseUrl="/lager"
        searchParams={paginationParams}
      />
    </div>
  );
}

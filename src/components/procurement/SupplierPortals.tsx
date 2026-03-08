"use client";

import { useState, useCallback } from "react";
import { Search, ExternalLink, ArrowLeft, ShoppingCart, Globe, Clock, Truck } from "lucide-react";
import Link from "next/link";
import { SUPPLIER_PORTALS, type SupplierPortal } from "@/lib/procurement/supplier-portals";
import { RegisterPurchaseForm } from "./RegisterPurchaseForm";

interface Props {
  initialQuery: string;
  initialSupplier: string;
}

export function SupplierPortals({ initialQuery }: Props) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const openSupplier = useCallback((portal: SupplierPortal, query?: string) => {
    const url = query?.trim()
      ? portal.searchUrl(query.trim())
      : portal.homeUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleSearchAll = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // Save to recent searches (max 5)
    setRecentSearches((prev) => {
      const updated = [q, ...prev.filter((s) => s !== q)].slice(0, 5);
      return updated;
    });

    // Open all suppliers with this search
    SUPPLIER_PORTALS.forEach((portal) => {
      window.open(portal.searchUrl(q), "_blank", "noopener,noreferrer");
    });
  }, [searchQuery]);

  const handleSearchSingle = useCallback((portal: SupplierPortal) => {
    const q = searchQuery.trim();
    if (!q) {
      openSupplier(portal);
      return;
    }

    setRecentSearches((prev) => {
      const updated = [q, ...prev.filter((s) => s !== q)].slice(0, 5);
      return updated;
    });

    openSupplier(portal, q);
  }, [searchQuery, openSupplier]);

  const supplierInfo: Record<string, { desc: string; delivery: string; note: string }> = {
    autodoc: {
      desc: "Brett sortiment, internationell leverans",
      delivery: "2–5 arbetsdagar",
      note: "Bra priser på vanliga slitdelar",
    },
    trodo: {
      desc: "Skandinavisk bildelsgrossist",
      delivery: "1–3 arbetsdagar",
      note: "Ofta lägst pris, snabb leverans",
    },
    bilxtra_pro: {
      desc: "B2B-portal (Mekonomen-koncernen)",
      delivery: "Samma dag / 1 arbetsdag",
      note: "Kräver inloggning, order före 14:00",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/lager"
            className="p-2 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-workshop-text flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Inköp
            </h1>
            <p className="text-workshop-muted text-sm">Sök och handla reservdelar hos leverantörer</p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="surface p-5">
        <form onSubmit={handleSearchAll} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-workshop-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök artikelnummer eller namn..."
              className="w-full pl-11 pr-4 py-3 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted text-sm focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!searchQuery.trim()}
            className="px-6 py-3 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            Sök hos alla
          </button>
        </form>

        {/* Recent searches */}
        {recentSearches.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-workshop-muted">Senaste:</span>
            {recentSearches.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setSearchQuery(q)}
                className="text-xs px-2 py-1 rounded bg-workshop-elevated text-workshop-muted hover:text-workshop-text hover:bg-workshop-border transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Supplier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SUPPLIER_PORTALS.map((portal) => {
          const info = supplierInfo[portal.id];
          return (
            <div
              key={portal.id}
              className="surface overflow-hidden flex flex-col"
            >
              {/* Card header with color */}
              <div className={`${portal.color} px-5 py-4 flex items-center gap-3`}>
                <span className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-lg font-bold text-white">
                  {portal.icon}
                </span>
                <div>
                  <h3 className="text-white font-bold text-lg">{portal.name}</h3>
                  <p className="text-white/70 text-xs">{info?.desc}</p>
                </div>
              </div>

              {/* Card body */}
              <div className="p-5 flex-1 flex flex-col gap-4">
                {/* Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-workshop-muted">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Leverans: <span className="text-workshop-text">{info?.delivery}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-workshop-muted">
                    <Truck className="h-4 w-4 shrink-0" />
                    <span>{info?.note}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-auto space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSearchSingle(portal)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${portal.color} hover:opacity-90 text-white rounded-lg text-sm font-medium transition-all`}
                  >
                    {searchQuery.trim() ? (
                      <>
                        <Search className="h-4 w-4" />
                        Sök &quot;{searchQuery.trim().length > 20 ? searchQuery.trim().slice(0, 20) + "…" : searchQuery.trim()}&quot;
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        Öppna {portal.shortName}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openSupplier(portal)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-workshop-elevated border border-workshop-border hover:bg-workshop-border text-workshop-muted hover:text-workshop-text rounded-lg text-xs transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Gå till {portal.name} startsida
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Purchase registration form */}
      <RegisterPurchaseForm />

      {/* Footer hint */}
      <div className="text-xs text-workshop-muted text-center py-2">
        Registrerade artiklar syns direkt i <Link href="/lager" className="text-workshop-accent hover:underline">Lagret</Link>.
      </div>
    </div>
  );
}

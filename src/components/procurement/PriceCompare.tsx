"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, TrendingDown, Clock, Package, ChevronDown, ChevronUp, Loader2, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PriceResult {
  source: string;
  sourceName?: string;
  price: number;
  deliveryDays: number;
  url: string;
  inStock: boolean;
  margin?: number;
}

interface Props {
  partId: string;
  partName: string;
  partNumber: string;
  currentCostPrice: number;
  currentSellPrice: number;
}

export function PriceCompare({ partId, partName, partNumber, currentCostPrice, currentSellPrice }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PriceResult[] | null>(null);
  const [bestSaving, setBestSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    if (results) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError(null);
    setExpanded(true);

    try {
      const res = await fetch("/api/procurement/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId, urgency: "no_rush" }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Sökning misslyckades");
      }

      const data = await res.json();
      const priceResults: PriceResult[] = data.results ?? [];

      // Calculate margins relative to current sell price
      const enriched = priceResults.map((r) => ({
        ...r,
        margin: currentSellPrice - r.price,
      }));

      setResults(enriched);

      // Find best saving compared to current cost
      if (enriched.length > 0) {
        const cheapest = Math.min(...enriched.map((r) => r.price));
        const saving = currentCostPrice - cheapest;
        if (saving > 0) setBestSaving(saving);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [partId, currentCostPrice, currentSellPrice, results, expanded]);

  // Auto-fetch on mount for background price check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!results && partId) {
        fetch("/api/procurement/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partId, urgency: "no_rush" }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.results) {
              const enriched = data.results.map((r: PriceResult) => ({
                ...r,
                margin: currentSellPrice - r.price,
              }));
              setResults(enriched);
              if (enriched.length > 0) {
                const cheapest = Math.min(...enriched.map((r: PriceResult) => r.price));
                const saving = currentCostPrice - cheapest;
                if (saving > 0) setBestSaving(saving);
              }
            }
          })
          .catch(() => {});
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId]);

  const deliveryLabel = (days: number) => {
    if (days === 0) return "Idag";
    if (days === 1) return "Imorgon";
    return `${days} dagar`;
  };

  return (
    <div>
      {/* Badge / trigger */}
      <button
        type="button"
        onClick={fetchPrices}
        disabled={loading}
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors
          ${bestSaving && bestSaving > 0
            ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
            : "bg-workshop-elevated text-workshop-muted hover:bg-workshop-border hover:text-workshop-text"
          }
        `}
        title="Jämför priser hos leverantörer"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : bestSaving && bestSaving > 0 ? (
          <>
            <TrendingDown className="h-3 w-3" />
            -{formatCurrency(bestSaving)}
          </>
        ) : (
          <>
            <Search className="h-3 w-3" />
            Jämför
          </>
        )}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Expanded panel */}
      {expanded && results && (
        <div className="mt-2 bg-workshop-elevated border border-workshop-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-workshop-bg/50 flex items-center justify-between">
            <span className="text-xs font-medium text-workshop-text">
              Prisjämförelse — {partNumber}
            </span>
            <span className="text-xs text-workshop-muted">
              Nuv. inköp: {formatCurrency(currentCostPrice)}
            </span>
          </div>

          {results.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-workshop-muted border-t border-workshop-border">
                  <th className="px-3 py-1.5 text-left">Källa</th>
                  <th className="px-2 py-1.5 text-right">Pris</th>
                  <th className="px-2 py-1.5 text-right">Leverans</th>
                  <th className="px-2 py-1.5 text-right">Marginal</th>
                  <th className="px-2 py-1.5 text-center">Lager</th>
                  <th className="px-2 py-1.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const isCheapest = r.price === Math.min(...results.map((x) => x.price));
                  return (
                    <tr
                      key={i}
                      className={`border-t border-workshop-border ${isCheapest ? "bg-green-900/10" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-workshop-text font-medium">{r.sourceName || r.source}</span>
                          {isCheapest && (
                            <span className="text-[10px] bg-green-900/50 text-green-400 px-1 py-0.5 rounded">
                              Bäst
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className={isCheapest ? "text-green-400 font-medium" : "text-workshop-text"}>
                          {formatCurrency(r.price)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className="flex items-center gap-1 justify-end text-workshop-muted">
                          <Clock className="h-3 w-3" />
                          {deliveryLabel(r.deliveryDays)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className={r.margin && r.margin > 0 ? "text-green-400" : "text-red-400"}>
                          {r.margin != null ? formatCurrency(r.margin) : "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {r.inStock ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-workshop-muted">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-1 rounded hover:bg-workshop-border text-workshop-muted hover:text-workshop-accent transition-colors"
                            title={`Öppna ${r.sourceName || r.source}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-workshop-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-3 py-4 text-center text-workshop-muted text-xs">
              Inga leverantörspriser hittades.
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-red-400 text-xs border-t border-workshop-border">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact badge for showing on part rows.
 * Auto-fetches and shows best saving inline.
 */
export function PriceCompareBadge({ partId, currentCostPrice, currentSellPrice }: {
  partId: string;
  currentCostPrice: number;
  currentSellPrice: number;
}) {
  const [bestSaving, setBestSaving] = useState<number | null>(null);
  const [bestSource, setBestSource] = useState<string>("");

  useEffect(() => {
    if (!partId) return;
    const timer = setTimeout(() => {
      fetch("/api/procurement/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId, urgency: "no_rush" }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.results?.length > 0) {
            const cheapest = data.results.reduce((min: any, r: any) =>
              r.price < min.price ? r : min, data.results[0]);
            const saving = currentCostPrice - cheapest.price;
            if (saving > 0) {
              setBestSaving(saving);
              setBestSource(cheapest.source);
            }
          }
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId]);

  if (!bestSaving || bestSaving <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded ml-1" title={`${bestSource}: ${formatCurrency(bestSaving)} billigare`}>
      <TrendingDown className="h-2.5 w-2.5" />
      {bestSource} -{formatCurrency(bestSaving)}
    </span>
  );
}

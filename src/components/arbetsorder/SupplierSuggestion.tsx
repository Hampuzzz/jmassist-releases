"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, TrendingDown, Clock, Package, Loader2, Check, ShoppingCart,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PriceResult } from "@/lib/procurement/mock-sources";

interface SupplierSuggestionProps {
  partId: string;
  partName: string;
  partNumber: string;
  currentCostPrice: number;
  currentSellPrice: number;
  workOrderId: string;
  quantity: number;
  onClose: () => void;
  onOrderComplete: () => void;
}

function deliveryLabel(days: number) {
  if (days === 0) return "Idag";
  if (days === 1) return "Imorgon";
  return `${days} dagar`;
}

export function SupplierSuggestion({
  partId,
  partName,
  partNumber,
  currentCostPrice,
  currentSellPrice,
  workOrderId,
  quantity,
  onClose,
  onOrderComplete,
}: SupplierSuggestionProps) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<PriceResult[]>([]);
  const [ordering, setOrdering] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch prices on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchPrices() {
      try {
        const res = await fetch("/api/procurement/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partId, urgency: "no_rush" }),
        });
        if (!res.ok) throw new Error("Kunde inte hämta priser");
        const data = await res.json();
        if (!cancelled) {
          // Sort by price ascending
          const sorted = (data.results ?? []).sort(
            (a: PriceResult, b: PriceResult) => a.price - b.price,
          );
          setResults(sorted);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Prisfel");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPrices();
    return () => { cancelled = true; };
  }, [partId]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleOrder = useCallback(async (result: PriceResult) => {
    setOrdering(result.source);
    setError(null);
    try {
      const res = await fetch("/api/inkop/registrera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: null,
          workOrderId,
          reference: `Auto-${partNumber}-${result.source}`,
          lines: [{
            partNumber,
            partName,
            quantity,
            unitCostPrice: result.price,
            sellPrice: currentSellPrice,
          }],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte registrera beställning");
      }

      setOrderSuccess(result.source);
      setOrdering(null);

      // Auto-close after 1.5 seconds
      setTimeout(() => {
        onOrderComplete();
      }, 1500);
    } catch (err: any) {
      setError(err.message ?? "Beställningsfel");
      setOrdering(null);
    }
  }, [workOrderId, partNumber, partName, quantity, currentSellPrice, onOrderComplete]);

  const cheapestPrice = results.length > 0 ? results[0].price : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-workshop-surface border border-workshop-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-workshop-border">
          <div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-green-400" />
              <h2 className="text-lg font-semibold text-workshop-text">
                Prisjämförelse
              </h2>
            </div>
            <p className="text-xs text-workshop-muted mt-1">
              {partName} ({partNumber})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current price subtitle */}
        <div className="px-5 py-3 bg-workshop-elevated/50 border-b border-workshop-border flex items-center justify-between">
          <span className="text-sm text-workshop-muted">
            Nuvarande inköpspris:{" "}
            <span className="text-workshop-text font-medium">
              {formatCurrency(currentCostPrice)}
            </span>
          </span>
          <span className="text-xs text-workshop-muted">
            {quantity} st
          </span>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3">
          {/* Loading state */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="animate-pulse bg-workshop-elevated rounded-lg h-20"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <p className="text-red-400 text-sm text-center py-2">{error}</p>
          )}

          {/* Results */}
          {!loading && results.length === 0 && !error && (
            <p className="text-workshop-muted text-sm text-center py-4">
              Inga leverantörspriser hittades.
            </p>
          )}

          {!loading &&
            results.map((r) => {
              const isCheapest = r.price === cheapestPrice;
              const saving = currentCostPrice - r.price;
              const isOrdering = ordering === r.source;
              const isOrdered = orderSuccess === r.source;

              return (
                <div
                  key={r.source}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isOrdered
                      ? "border-green-700 bg-green-900/20"
                      : isCheapest
                        ? "border-green-800/50 bg-green-900/10"
                        : "border-workshop-border bg-workshop-elevated"
                  }`}
                >
                  {/* Left: supplier info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-workshop-text truncate">
                        {r.sourceName}
                      </span>
                      {isCheapest && (
                        <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded flex-shrink-0">
                          Bäst pris
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-workshop-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {deliveryLabel(r.deliveryDays)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className={`h-3 w-3 ${r.inStock ? "text-green-400" : "text-workshop-muted"}`} />
                        {r.inStock ? "I lager" : "Ej i lager"}
                      </span>
                    </div>
                  </div>

                  {/* Center: price */}
                  <div className="text-right space-y-0.5 flex-shrink-0">
                    <p
                      className={`text-lg font-bold ${
                        isCheapest ? "text-green-400" : "text-workshop-text"
                      }`}
                    >
                      {formatCurrency(r.price)}
                    </p>
                    {saving > 0 && (
                      <p className="text-[11px] text-green-400">
                        -{formatCurrency(saving)}
                      </p>
                    )}
                    {saving < 0 && (
                      <p className="text-[11px] text-red-400">
                        +{formatCurrency(Math.abs(saving))}
                      </p>
                    )}
                  </div>

                  {/* Right: order button */}
                  <div className="flex-shrink-0">
                    {isOrdered ? (
                      <span className="flex items-center gap-1 px-3 py-2 bg-green-900/30 text-green-400 text-xs rounded-md font-medium">
                        <Check className="h-3.5 w-3.5" />
                        Beställd
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOrder(r)}
                        disabled={!!ordering || !!orderSuccess}
                        className="flex items-center gap-1 px-3 py-2 bg-workshop-accent hover:bg-amber-600 text-white text-xs rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isOrdering ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShoppingCart className="h-3.5 w-3.5" />
                        )}
                        {isOrdering ? "..." : "Beställ"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Hint when all are more expensive */}
          {!loading &&
            results.length > 0 &&
            results.every((r) => r.price >= currentCostPrice) && (
              <p className="text-xs text-workshop-muted text-center pt-1">
                Nuvarande inköpspris är redan bland de lägsta.
              </p>
            )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-workshop-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-workshop-muted hover:text-workshop-text transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

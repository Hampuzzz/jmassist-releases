"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Car } from "lucide-react";
import { cn } from "@/lib/utils";

interface VhcItemPublic {
  id: string;
  category: string;
  label: string;
  severity: "green" | "yellow" | "red";
  comment: string;
  estimatedCost: string;
  customerApproved: boolean;
  mediaUrls: string[];
}

interface Props {
  vhcId: string;
  token: string;
  status: string;
  createdAt: string;
  vehicle: { regNr: string; brand: string; model: string; modelYear: number | null };
  items: VhcItemPublic[];
}

const CATEGORY_LABELS: Record<string, string> = {
  brakes: "Bromsar",
  tires: "Däck",
  lights: "Belysning",
  fluids: "Vätskor",
  suspension: "Fjädring & styrning",
  exhaust: "Avgassystem",
  body: "Kaross & övrigt",
  custom: "Verkstadens anmärkningar",
};

const SEVERITY_LABELS: Record<string, { icon: typeof CheckCircle2; text: string; color: string; bg: string }> = {
  green:  { icon: CheckCircle2,  text: "OK",                         color: "text-green-500",  bg: "bg-green-500/10" },
  yellow: { icon: AlertTriangle, text: "Bör åtgärdas",               color: "text-yellow-500", bg: "bg-yellow-500/10" },
  red:    { icon: XCircle,       text: "Akut — trafiksäkerhetsrisk",  color: "text-red-500",    bg: "bg-red-500/10" },
};

const SEVERITY_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2 };

function isVideoUrl(url: string): boolean {
  const videoExts = [".mp4", ".mov", ".webm", ".avi", ".m4v"];
  const lower = url.toLowerCase().split("?")[0];
  return videoExts.some((ext) => lower.endsWith(ext));
}

export function CheckupClient({ vhcId, token, status, createdAt, vehicle, items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(status === "approved");

  const actionableItems = items.filter((i) => i.severity !== "green");
  const selectedItems = items.filter((i) => i.severity !== "green" && i.customerApproved);
  const totalCost = selectedItems.reduce((sum, i) => sum + (parseFloat(i.estimatedCost) || 0), 0);

  const toggleApproval = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, customerApproved: !item.customerApproved } : item,
      ),
    );
  }, []);

  const handleApproveAll = async () => {
    setApproving(true);
    try {
      const payload = items
        .filter((i) => i.severity !== "green")
        .map((i) => ({ id: i.id, customerApproved: i.customerApproved }));

      await fetch(`/api/vhc/${vhcId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });

      await fetch(`/api/vhc/${vhcId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", customerApprovedAt: new Date().toISOString() }),
      });

      setApproved(true);
    } catch (err) {
      console.error("Approval failed:", err);
    } finally {
      setApproving(false);
    }
  };

  // Separate custom (quick-video) items from standard checklist
  const customItems = items.filter((i) => i.category === "custom");
  const standardItems = items.filter((i) => i.category !== "custom");

  // Group standard items by category, sorted by severity within each group
  const categories = Object.entries(
    standardItems.reduce<Record<string, VhcItemPublic[]>>((acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    }, {}),
  ).map(
    ([key, catItems]) =>
      [
        key,
        catItems.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)),
      ] as [string, VhcItemPublic[]],
  );

  const date = new Date(createdAt).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Hälsokontroll</h1>
              <p className="text-sm text-gray-500">JM Trading — Gråbo</p>
            </div>
          </div>
          <div className="mt-3 bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-semibold text-gray-900">
              {vehicle.regNr} — {vehicle.brand} {vehicle.model} {vehicle.modelYear ?? ""}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{date}</p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["green", "yellow", "red"] as const).map((sev) => {
            const count = items.filter((i) => i.severity === sev).length;
            const cfg = SEVERITY_LABELS[sev];
            const Icon = cfg.icon;
            return (
              <div key={sev} className={cn("rounded-lg p-3 text-center", cfg.bg)}>
                <Icon className={cn("w-5 h-5 mx-auto mb-1", cfg.color)} />
                <p className={cn("text-xl font-bold", cfg.color)}>{count}</p>
                <p className="text-xs text-gray-600">{cfg.text.split("—")[0].trim()}</p>
              </div>
            );
          })}
        </div>

        {/* HERO section — custom / quick-video items */}
        {customItems.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              {CATEGORY_LABELS.custom}
            </h3>
            {customItems.map((item) => {
              const cfg = SEVERITY_LABELS[item.severity];
              const Icon = cfg.icon;
              const cost = parseFloat(item.estimatedCost) || 0;
              const isActionable = item.severity !== "green";

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border-2 border-red-200 shadow-md p-4 mb-3"
                >
                  {/* Media hero — video/images prominently at top */}
                  {item.mediaUrls.length > 0 && (
                    <div className="mb-3 -mx-1 space-y-2">
                      {item.mediaUrls.map((url, i) =>
                        isVideoUrl(url) ? (
                          <video
                            key={i}
                            src={url}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full rounded-lg"
                          />
                        ) : (
                          <img
                            key={i}
                            src={url}
                            alt={`Bild ${i + 1}`}
                            className="w-full rounded-lg object-cover"
                            loading="lazy"
                          />
                        ),
                      )}
                    </div>
                  )}

                  {/* Item details */}
                  <div className="flex items-start gap-3">
                    <Icon className={cn("w-6 h-6 flex-shrink-0 mt-0.5", cfg.color)} />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-base">{item.label}</p>
                      {item.comment && (
                        <p className="text-sm text-gray-500 mt-1">{item.comment}</p>
                      )}
                    </div>
                  </div>

                  {/* Large approval button */}
                  {isActionable && !approved && (
                    <button
                      type="button"
                      onClick={() => toggleApproval(item.id)}
                      className={cn(
                        "w-full mt-3 py-3.5 rounded-xl font-semibold text-base transition-all touch-manipulation",
                        item.customerApproved
                          ? "bg-green-500 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200",
                      )}
                    >
                      {item.customerApproved
                        ? `\u2713 Godkänd — ${cost.toLocaleString("sv-SE")} kr`
                        : `Godkänn åtgärd — ${cost.toLocaleString("sv-SE")} kr`}
                    </button>
                  )}

                  {isActionable && approved && item.customerApproved && (
                    <div className="mt-3 text-center">
                      <span className="text-sm bg-green-100 text-green-700 px-4 py-1.5 rounded-full font-medium">
                        {"\u2713"} Godkänd
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Standard category sections */}
        {categories.map(([catKey, catItems]) => (
          <div key={catKey} className="mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">
              {CATEGORY_LABELS[catKey] ?? catKey}
            </h3>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {catItems.map((item) => {
                const cfg = SEVERITY_LABELS[item.severity];
                const Icon = cfg.icon;
                const isActionable = item.severity !== "green";
                const cost = parseFloat(item.estimatedCost) || 0;

                return (
                  <div key={item.id} className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-5 h-5 flex-shrink-0", cfg.color)} />
                      <span className="flex-1 text-sm text-gray-800">{item.label}</span>

                      {isActionable && cost > 0 && (
                        <span className="text-sm font-medium text-gray-600">
                          {cost.toLocaleString("sv-SE")} kr
                        </span>
                      )}

                      {isActionable && !approved && (
                        <button
                          type="button"
                          onClick={() => toggleApproval(item.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all touch-manipulation whitespace-nowrap",
                            item.customerApproved
                              ? "bg-green-500 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200",
                          )}
                        >
                          {item.customerApproved ? "Godkänd" : "Godkänn"}
                        </button>
                      )}

                      {isActionable && approved && item.customerApproved && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Godkänd
                        </span>
                      )}
                    </div>

                    {item.comment && (
                      <p className="mt-1 ml-7 text-xs text-gray-500">{item.comment}</p>
                    )}

                    {/* Media — full-size video/images instead of tiny thumbnails */}
                    {item.mediaUrls.length > 0 && (
                      <div className="mt-2 ml-7 space-y-2">
                        {item.mediaUrls.map((url, i) =>
                          isVideoUrl(url) ? (
                            <video
                              key={i}
                              src={url}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full max-w-md rounded-xl border border-gray-200 shadow-sm"
                            />
                          ) : (
                            <img
                              key={i}
                              src={url}
                              alt={`Bild ${i + 1}`}
                              className="w-full max-w-md rounded-xl border border-gray-200 shadow-sm object-cover"
                              loading="lazy"
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Approval sticky bar — always visible when there are actionable items */}
        {actionableItems.length > 0 && !approved && (
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-4 -mx-4 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">
                  {selectedItems.length} av {actionableItems.length} åtgärder valda
                </span>
                {totalCost > 0 && (
                  <span className="font-bold text-gray-900 text-base">
                    {totalCost.toLocaleString("sv-SE")} kr
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleApproveAll}
                disabled={selectedItems.length === 0 || approving}
                className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation shadow-lg active:scale-[0.98]"
              >
                {approving ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : selectedItems.length === 0 ? (
                  "Välj åtgärder ovan"
                ) : (
                  `Godkänn valda (${totalCost.toLocaleString("sv-SE")} kr)`
                )}
              </button>
            </div>
          </div>
        )}

        {approved && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-semibold text-gray-900">Tack för ditt godkännande!</p>
            <p className="text-sm text-gray-500">Verkstaden har fått din bekräftelse och kontaktar dig.</p>
          </div>
        )}
      </div>
    </div>
  );
}

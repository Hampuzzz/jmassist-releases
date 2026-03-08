"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, X, Pencil } from "lucide-react";

interface LineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPct: string;
  lineType: string;
  vmbEligible: boolean;
  costBasis: string;
}

const emptyLine: LineItem = {
  description: "",
  quantity: "1",
  unit: "st",
  unitPrice: "",
  discountPct: "0",
  lineType: "labor",
  vmbEligible: false,
  costBasis: "",
};

interface Props {
  invoiceId: string;
  isDraft: boolean;
  initialLines: Array<{
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discountPct: string;
    lineType: string;
    vmbEligible: boolean;
    costBasis: string | null;
  }>;
}

export function InvoiceLineEditor({ invoiceId, isDraft, initialLines }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<LineItem[]>(
    initialLines.length > 0
      ? initialLines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct,
          lineType: l.lineType,
          vmbEligible: l.vmbEligible,
          costBasis: l.costBasis ?? "",
        }))
      : [{ ...emptyLine }],
  );

  if (!isDraft) return null;

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LineItem, value: string | boolean) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    );
  }

  function calcLineTotal(line: LineItem) {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unitPrice) || 0;
    const disc = parseFloat(line.discountPct) || 0;
    return qty * price * (1 - disc / 100);
  }

  function calcTotals() {
    let subtotal = 0;
    let vat = 0;
    let vmbVat = 0;
    for (const line of lines) {
      const lt = calcLineTotal(line);
      subtotal += lt;
      if (line.vmbEligible) {
        // VMB: VAT is 1/5 of margin (sell price - cost basis)
        const qty = parseFloat(line.quantity) || 0;
        const price = parseFloat(line.unitPrice) || 0;
        const disc = parseFloat(line.discountPct) || 0;
        const cost = parseFloat(line.costBasis) || 0;
        const effectivePrice = price * (1 - disc / 100);
        const margin = effectivePrice - cost;
        if (margin > 0) vmbVat += margin * qty * 0.20;
      } else {
        vat += lt * 0.25;
      }
    }
    return { subtotal, vat: vat + vmbVat, total: subtotal + vat + vmbVat };
  }

  async function handleSave() {
    // Validate
    const validLines = lines.filter(
      (l) => l.description.trim() && (parseFloat(l.unitPrice) || 0) > 0,
    );
    if (validLines.length === 0) {
      setError("Minst en rad med beskrivning och pris krävs.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/faktura/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: validLines }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Kunde inte spara rader.");
        return;
      }

      setEditing(false);
      router.refresh();
    } catch {
      setError("Nätverksfel vid sparande.");
    } finally {
      setSaving(false);
    }
  }

  const totals = calcTotals();

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="no-print flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium transition-colors"
      >
        <Pencil className="h-4 w-4" />
        Redigera rader
      </button>
    );
  }

  return (
    <div className="no-print space-y-4 surface p-4 md:p-6 border border-workshop-accent/30 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-workshop-text">
          Redigera fakturarader
        </h3>
        <button
          onClick={() => setEditing(false)}
          className="p-1.5 rounded-md hover:bg-workshop-elevated text-workshop-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {lines.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 items-end bg-workshop-bg/50 p-3 rounded-md"
          >
            {/* Description - spans more on small screens */}
            <div className="col-span-12 md:col-span-4">
              <label className="text-xs text-workshop-muted block mb-1">
                Beskrivning
              </label>
              <input
                type="text"
                value={line.description}
                onChange={(e) => updateLine(i, "description", e.target.value)}
                placeholder="t.ex. Oljebyte"
                className="w-full px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-sm text-workshop-text"
              />
            </div>

            {/* Type */}
            <div className="col-span-4 md:col-span-1">
              <label className="text-xs text-workshop-muted block mb-1">Typ</label>
              <select
                value={line.lineType}
                onChange={(e) => updateLine(i, "lineType", e.target.value)}
                className="w-full px-2 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-sm text-workshop-text"
              >
                <option value="labor">Arbete</option>
                <option value="part">Del</option>
                <option value="fee">Avgift</option>
                <option value="discount">Rabatt</option>
              </select>
            </div>

            {/* Quantity */}
            <div className="col-span-4 md:col-span-1">
              <label className="text-xs text-workshop-muted block mb-1">Antal</label>
              <input
                type="text"
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => updateLine(i, "quantity", e.target.value)}
                className="w-full px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-sm text-workshop-text text-right"
              />
            </div>

            {/* Unit */}
            <div className="col-span-4 md:col-span-1">
              <label className="text-xs text-workshop-muted block mb-1">Enhet</label>
              <select
                value={line.unit}
                onChange={(e) => updateLine(i, "unit", e.target.value)}
                className="w-full px-2 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-sm text-workshop-text"
              >
                <option value="st">st</option>
                <option value="tim">tim</option>
                <option value="m">m</option>
                <option value="l">l</option>
                <option value="kg">kg</option>
              </select>
            </div>

            {/* Unit price */}
            <div className="col-span-4 md:col-span-2">
              <label className="text-xs text-workshop-muted block mb-1">
                Pris (exkl. moms)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={line.unitPrice}
                onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-sm text-workshop-text text-right"
              />
            </div>

            {/* Discount */}
            <div className="col-span-4 md:col-span-1">
              <label className="text-xs text-workshop-muted block mb-1">Rabatt %</label>
              <input
                type="text"
                inputMode="decimal"
                value={line.discountPct}
                onChange={(e) => updateLine(i, "discountPct", e.target.value)}
                className="w-full px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-sm text-workshop-text text-right"
              />
            </div>

            {/* Line total (computed) */}
            <div className="col-span-3 md:col-span-1">
              <label className="text-xs text-workshop-muted block mb-1">Belopp</label>
              <div className="px-3 py-2 text-sm text-workshop-text text-right font-mono">
                {calcLineTotal(line).toLocaleString("sv-SE", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>

            {/* Delete button */}
            <div className="col-span-1 flex justify-end">
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="p-2 rounded-md hover:bg-red-900/30 text-workshop-muted hover:text-red-400 transition-colors"
                title="Ta bort rad"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add line + totals */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-workshop-accent hover:text-workshop-accent-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ny rad
        </button>

        <div className="text-sm space-y-1 text-right min-w-[200px]">
          <div className="flex justify-between gap-8">
            <span className="text-workshop-muted">Exkl. moms:</span>
            <span className="font-mono text-workshop-text">
              {totals.subtotal.toLocaleString("sv-SE", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              kr
            </span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-workshop-muted">Moms 25%:</span>
            <span className="font-mono text-workshop-text">
              {totals.vat.toLocaleString("sv-SE", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              kr
            </span>
          </div>
          <div className="flex justify-between gap-8 border-t border-workshop-border pt-1">
            <span className="font-bold text-workshop-text">Totalt:</span>
            <span className="font-bold font-mono text-workshop-accent">
              {totals.total.toLocaleString("sv-SE", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              kr
            </span>
          </div>
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex justify-end gap-3 pt-2 border-t border-workshop-border">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-4 py-2 text-sm text-workshop-muted hover:text-workshop-text transition-colors"
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Sparar..." : "Spara rader"}
        </button>
      </div>
    </div>
  );
}

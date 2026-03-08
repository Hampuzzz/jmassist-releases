"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Loader2, Check, Plus, Trash2,
  FileText, Receipt, Search, X,
} from "lucide-react";
import { VAT_RATE } from "@/lib/constants";

/* ── Types ─────────────────────────────────────────────── */

interface LineItem {
  id: string;
  lineType: "labor" | "part" | "fee" | "discount";
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPct: string;
  vmbEligible: boolean;
  costBasis: string;
}

interface CustomerOption {
  id: string;
  label: string;
  sub: string;
}

/* ── Helpers ───────────────────────────────────────────── */

function emptyLine(type: LineItem["lineType"] = "labor"): LineItem {
  return {
    id: crypto.randomUUID(),
    lineType: type,
    description: "",
    quantity: "1",
    unit: type === "labor" ? "tim" : "st",
    unitPrice: "",
    discountPct: "0",
    vmbEligible: false,
    costBasis: "0",
  };
}

function num(v: string) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function lineTotal(l: LineItem) {
  return num(l.quantity) * num(l.unitPrice) * (1 - num(l.discountPct) / 100);
}

function money(v: number) {
  return v.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Page ──────────────────────────────────────────────── */

function NyFakturaPageContent() {
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);

  const initialType = searchParams.get("type") === "quote" ? "quote" : "invoice";

  /* State */
  const [type, setType] = useState<"invoice" | "quote">(initialType);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [paymentTermsDays, setPaymentTermsDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine("labor")]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  /* ── Close dropdown on outside click ────────────────── */
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Customer search ─────────────────────────────────── */
  const searchCustomers = useCallback(async (q: string) => {
    if (q.length < 1) { setCustomerResults([]); return; }
    try {
      const res = await fetch(`/api/kunder?search=${encodeURIComponent(q)}&limit=10`);
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data ?? json;
      setCustomerResults(
        (Array.isArray(data) ? data : []).map((c: any) => ({
          id: c.id,
          label: c.isCompany
            ? c.companyName ?? "Företag"
            : [c.firstName, c.lastName].filter(Boolean).join(" ") || "Namnlös",
          sub: c.isCompany ? `Org: ${c.orgNr ?? "–"}` : (c.phone ?? c.email ?? ""),
        })),
      );
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  function selectCustomer(c: CustomerOption) {
    setCustomerId(c.id);
    setSelectedCustomerLabel(c.label);
    setCustomerSearch("");
    setShowCustomerDropdown(false);
  }

  /* ── Line item helpers ───────────────────────────────── */
  function updateLine(id: string, patch: Partial<LineItem>) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  function addLine(type: LineItem["lineType"] = "labor") {
    setLines((prev) => [...prev, emptyLine(type)]);
  }

  /* ── Totals ──────────────────────────────────────────── */
  const subtotalExVat = lines.reduce((s, l) => s + lineTotal(l), 0);
  const standardLines = lines.filter((l) => !l.vmbEligible);
  const vmbLines = lines.filter((l) => l.vmbEligible);
  const standardVat = standardLines.reduce((s, l) => s + lineTotal(l) * VAT_RATE, 0);
  const vmbTax = vmbLines.reduce((s, l) => {
    const margin = num(l.unitPrice) - num(l.costBasis);
    return s + (margin > 0 ? margin * num(l.quantity) * 0.20 : 0);
  }, 0);
  const totalVat = standardVat + vmbTax;
  const totalIncVat = subtotalExVat + totalVat;

  /* ── Submit ──────────────────────────────────────────── */
  const submittedRef = useRef(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittedRef.current || saving) return; // Block double-submit
    submittedRef.current = true;
    setError("");
    setSaving(true);

    if (!customerId) { setError("Välj en kund."); setSaving(false); submittedRef.current = false; return; }

    const validLines = lines.filter((l) => l.description.trim() && num(l.unitPrice) > 0);
    if (validLines.length === 0) { setError("Lägg till minst en fakturarad med beskrivning och pris."); setSaving(false); submittedRef.current = false; return; }

    const body = {
      type,
      customerId,
      paymentTermsDays: parseInt(paymentTermsDays) || 30,
      notes: notes || null,
      lines: validLines.map((l, i) => ({
        sortOrder: i,
        lineType: l.lineType,
        description: l.description.trim(),
        quantity: num(l.quantity).toString(),
        unit: l.unit,
        unitPrice: num(l.unitPrice).toString(),
        discountPct: num(l.discountPct).toString(),
        vmbEligible: l.vmbEligible,
        costBasis: l.vmbEligible ? num(l.costBasis).toString() : null,
      })),
    };

    try {
      const res = await fetch("/api/faktura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Något gick fel vid skapandet.");
        setSaving(false);
        submittedRef.current = false;
        return;
      }

      const created = await res.json();
      const newId = created?.data?.id;
      setSuccess(true);
      setTimeout(() => {
        window.location.href = newId ? `/faktura/${newId}` : `/faktura?type=${type}`;
      }, 1200);
    } catch {
      setError("Nätverksfel — kontrollera anslutningen.");
      setSaving(false);
      submittedRef.current = false;
    }
  }

  /* ── Success screen ──────────────────────────────────── */
  if (success) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="surface p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-900/50 border-2 border-green-500 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-workshop-text mb-2">
            {type === "quote" ? "Offert skapad!" : "Faktura skapad!"}
          </h2>
          <p className="text-workshop-muted">Du skickas tillbaka till listan...</p>
        </div>
      </div>
    );
  }

  /* ── Form ────────────────────────────────────────────── */
  const isQuote = type === "quote";
  const typeLabel = isQuote ? "Offert" : "Faktura";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/faktura"
          className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-workshop-text" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Ny {typeLabel.toLowerCase()}</h1>
          <p className="text-workshop-muted text-sm">Skapa en ny {typeLabel.toLowerCase()} i systemet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Type toggle ─────────────────────────────── */}
        <div className="surface p-5">
          <label className="text-sm font-medium text-workshop-muted uppercase tracking-wider block mb-3">
            Dokumenttyp
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setType("invoice")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${
                !isQuote
                  ? "border-workshop-accent bg-workshop-accent/10 text-workshop-accent"
                  : "border-workshop-border text-workshop-muted hover:border-workshop-muted"
              }`}
            >
              <Receipt className="h-5 w-5" />
              Faktura
            </button>
            <button
              type="button"
              onClick={() => setType("quote")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${
                isQuote
                  ? "border-workshop-accent bg-workshop-accent/10 text-workshop-accent"
                  : "border-workshop-border text-workshop-muted hover:border-workshop-muted"
              }`}
            >
              <FileText className="h-5 w-5" />
              Offert
            </button>
          </div>
        </div>

        {/* ── Customer ────────────────────────────────── */}
        <div className="surface p-5 space-y-3">
          <label className="text-sm font-medium text-workshop-muted uppercase tracking-wider block">
            Kund *
          </label>

          {customerId ? (
            <div className="flex items-center gap-3 p-3 bg-workshop-elevated border border-workshop-border rounded-lg">
              <div className="flex-1">
                <p className="text-workshop-text font-medium">{selectedCustomerLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerId("");
                  setSelectedCustomerLabel("");
                }}
                className="p-1.5 hover:bg-workshop-surface rounded transition-colors"
              >
                <X className="h-4 w-4 text-workshop-muted" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-workshop-muted" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Sök kund efter namn, telefon eller e-post..."
                  className="w-full pl-10 pr-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                />
              </div>
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-workshop-elevated border border-workshop-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-workshop-surface transition-colors border-b border-workshop-border/50 last:border-0"
                    >
                      <p className="text-workshop-text text-sm font-medium">{c.label}</p>
                      <p className="text-workshop-muted text-xs">{c.sub}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Payment terms ───────────────────────────── */}
        <div className="surface p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Betalningsvillkor (dagar)</label>
              <input
                type="text"
                inputMode="numeric"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
          </div>
        </div>

        {/* ── Line items ──────────────────────────────── */}
        <div className="surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">
              Rader
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addLine("labor")}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-workshop-elevated border border-workshop-border rounded-md hover:bg-workshop-surface text-workshop-text transition-colors"
              >
                <Plus className="h-3 w-3" /> Arbete
              </button>
              <button
                type="button"
                onClick={() => addLine("part")}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-workshop-elevated border border-workshop-border rounded-md hover:bg-workshop-surface text-workshop-text transition-colors"
              >
                <Plus className="h-3 w-3" /> Del
              </button>
              <button
                type="button"
                onClick={() => addLine("fee")}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-workshop-elevated border border-workshop-border rounded-md hover:bg-workshop-surface text-workshop-text transition-colors"
              >
                <Plus className="h-3 w-3" /> Avgift
              </button>
            </div>
          </div>

          {/* Line rows */}
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="p-3 bg-workshop-elevated border border-workshop-border rounded-lg space-y-3">
                {/* Row 1: Type badge + Description */}
                <div className="flex items-start gap-3">
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded font-medium shrink-0 ${
                    line.lineType === "labor" ? "bg-blue-900/50 text-blue-300" :
                    line.lineType === "part" ? "bg-amber-900/50 text-amber-300" :
                    line.lineType === "fee" ? "bg-purple-900/50 text-purple-300" :
                    "bg-red-900/50 text-red-300"
                  }`}>
                    {line.lineType === "labor" ? "Arbete" :
                     line.lineType === "part" ? "Del" :
                     line.lineType === "fee" ? "Avgift" : "Rabatt"}
                  </span>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(line.id, { description: e.target.value })}
                    placeholder="Beskrivning"
                    className="flex-1 px-2 py-1 bg-transparent border-b border-workshop-border text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:border-workshop-accent text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="p-1 hover:bg-red-900/30 rounded transition-colors shrink-0"
                    title="Ta bort rad"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>

                {/* Row 2: Antal, Enhet, Pris, Rabatt, Summa */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                  <div>
                    <label className="block text-xs text-workshop-muted mb-0.5">Antal</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                      className="w-full px-2 py-1.5 bg-workshop-surface border border-workshop-border rounded text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-workshop-muted mb-0.5">Enhet</label>
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                      className="w-full px-2 py-1.5 bg-workshop-surface border border-workshop-border rounded text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent text-sm"
                    >
                      <option value="st">st</option>
                      <option value="tim">tim</option>
                      <option value="m">m</option>
                      <option value="l">l</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-workshop-muted mb-0.5">Pris (ex moms)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })}
                      placeholder="0"
                      className="w-full px-2 py-1.5 bg-workshop-surface border border-workshop-border rounded text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-1 focus:ring-workshop-accent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-workshop-muted mb-0.5">Rabatt %</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.discountPct}
                      onChange={(e) => updateLine(line.id, { discountPct: e.target.value })}
                      className="w-full px-2 py-1.5 bg-workshop-surface border border-workshop-border rounded text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-workshop-muted mb-0.5">Summa</label>
                    <div className="px-2 py-1.5 text-workshop-text text-sm font-medium">
                      {money(lineTotal(line))}
                    </div>
                  </div>
                </div>

                {/* VMB toggle for parts */}
                {line.lineType === "part" && (
                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs text-workshop-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={line.vmbEligible}
                        onChange={(e) => updateLine(line.id, { vmbEligible: e.target.checked })}
                        className="rounded border-workshop-border"
                      />
                      VMB (marginalmoms)
                    </label>
                    {line.vmbEligible && (
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-workshop-muted">Inköpspris:</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.costBasis}
                          onChange={(e) => updateLine(line.id, { costBasis: e.target.value })}
                          className="w-24 px-2 py-1 bg-workshop-surface border border-workshop-border rounded text-workshop-text text-xs focus:outline-none focus:ring-1 focus:ring-workshop-accent"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Totals ──────────────────────────────────── */}
        <div className="surface p-5">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider mb-3">Summering</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-workshop-muted">
              <span>Netto (ex moms)</span>
              <span>{money(subtotalExVat)} kr</span>
            </div>
            {standardVat > 0 && (
              <div className="flex justify-between text-workshop-muted">
                <span>Moms 25%</span>
                <span>{money(standardVat)} kr</span>
              </div>
            )}
            {vmbTax > 0 && (
              <div className="flex justify-between text-workshop-muted">
                <span>VMB-skatt</span>
                <span>{money(vmbTax)} kr</span>
              </div>
            )}
            <div className="flex justify-between text-workshop-text font-bold text-base pt-2 border-t border-workshop-border">
              <span>Att betala</span>
              <span>{money(totalIncVat)} kr</span>
            </div>
          </div>
        </div>

        {/* ── Notes ───────────────────────────────────── */}
        <div className="surface p-5 space-y-3">
          <label className="text-sm font-medium text-workshop-muted uppercase tracking-wider block">
            Anteckningar
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Valfria anteckningar till fakturan..."
            className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent resize-none"
          />
        </div>

        {/* ── Error ───────────────────────────────────── */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* ── Actions ─────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/faktura"
            className="px-5 py-2.5 bg-workshop-surface border border-workshop-border rounded-lg text-workshop-text hover:bg-workshop-elevated transition-colors text-sm"
          >
            Avbryt
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Spara {typeLabel.toLowerCase()}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NyFakturaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-workshop-muted">Laddar...</div>}>
      <NyFakturaPageContent />
    </Suspense>
  );
}

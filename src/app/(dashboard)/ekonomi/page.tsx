"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  TrendingUp, TrendingDown, DollarSign, Receipt,
  Wallet, PiggyBank, ShoppingCart, Wrench,
  ChevronLeft, ChevronRight, Plus, Trash2,
  Target, AlertTriangle, Loader2, ArrowUpRight,
} from "lucide-react";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/db/schemas/expenses";

// ─── Types ───
interface EkonomiSummary {
  period: { year: number; month: number | null; startDate: string; endDate: string };
  revenue: number;
  laborRevenue: number;
  partsRevenue: number;
  feeRevenue: number;
  partsCost: number;
  grossProfit: number;
  standardVat: number;
  vmbVat: number;
  vatToPay: number;
  expenseVatDeductible: number;
  totalExpenses: number;
  netProfit: number;
  invoiceCount: number;
  breakEvenRevenue: number;
  revenueProgress: number;
  expensesByCategory: { category: string; amount: number; vat: number; count: number }[];
}

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: string;
  vatAmount: string;
  vatDeductible: boolean;
  supplier: string | null;
  description: string;
  isRecurring: boolean;
}

const MONTHS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

function fmt(n: number): string {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtKr(n: number): string {
  return `${fmt(n)} kr`;
}

export default function EkonomiPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const summaryKey = `/api/ekonomi/summary?year=${year}&month=${month}`;
  const expensesKey = `/api/ekonomi/expenses?year=${year}&month=${month}`;

  const { data: summaryData, isLoading: summaryLoading } = useSWR<EkonomiSummary>(summaryKey);
  const { data: expensesData, mutate: mutateExpenses } = useSWR<{ data: Expense[] }>(expensesKey);

  const s = summaryData;
  const expenseList = expensesData?.data ?? [];

  // Month navigation
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header + month picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Ekonomi</h1>
          <p className="text-workshop-muted text-sm">Lönsamhet, moms och utgifter</p>
        </div>
        <div className="flex items-center gap-2 bg-workshop-surface border border-workshop-border rounded-lg px-2">
          <button onClick={prevMonth} className="p-2 text-workshop-muted hover:text-workshop-text">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-workshop-text min-w-[140px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 text-workshop-muted hover:text-workshop-text">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {summaryLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-workshop-accent animate-spin" />
        </div>
      )}

      {s && (
        <>
          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Omsättning"
              value={fmtKr(s.revenue)}
              sub={`${s.invoiceCount} fakturor`}
              icon={DollarSign}
              color="text-green-400"
            />
            <KpiCard
              label="Inköpskostnad delar"
              value={fmtKr(s.partsCost)}
              sub={`Marginal: ${s.partsRevenue > 0 ? Math.round(((s.partsRevenue - s.partsCost) / s.partsRevenue) * 100) : 0}%`}
              icon={ShoppingCart}
              color="text-blue-400"
            />
            <KpiCard
              label="Moms att betala"
              value={fmtKr(s.vatToPay)}
              sub={`Standard: ${fmtKr(s.standardVat)} · VMB: ${fmtKr(s.vmbVat)}`}
              icon={Receipt}
              color="text-amber-400"
            />
            <KpiCard
              label="Nettovinst"
              value={fmtKr(s.netProfit)}
              sub={`Brutto: ${fmtKr(s.grossProfit)}`}
              icon={s.netProfit >= 0 ? TrendingUp : TrendingDown}
              color={s.netProfit >= 0 ? "text-green-400" : "text-red-400"}
              highlight={s.netProfit < 0}
            />
          </div>

          {/* ─── Revenue Breakdown + Break-even ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue breakdown */}
            <div className="surface p-5 space-y-4">
              <h2 className="font-semibold text-workshop-text flex items-center gap-2">
                <Wallet className="h-4 w-4 text-workshop-accent" />
                Intäktsfördelning
              </h2>
              <div className="space-y-3">
                <RevenueBar label="Arbete" value={s.laborRevenue} total={s.revenue} color="bg-amber-500" />
                <RevenueBar label="Delar" value={s.partsRevenue} total={s.revenue} color="bg-blue-500" />
                <RevenueBar label="Avgifter" value={s.feeRevenue} total={s.revenue} color="bg-purple-500" />
              </div>

              {/* VAT details */}
              <div className="border-t border-workshop-border pt-3 space-y-2">
                <h3 className="text-xs text-workshop-muted uppercase tracking-wider">Momsberäkning</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-workshop-muted">Utgående moms (25%)</div>
                  <div className="text-workshop-text text-right font-mono">{fmtKr(s.standardVat)}</div>
                  <div className="text-workshop-muted">VMB-moms (marginal)</div>
                  <div className="text-workshop-text text-right font-mono">{fmtKr(s.vmbVat)}</div>
                  <div className="text-workshop-muted">– Ingående moms (avdrag)</div>
                  <div className="text-green-400 text-right font-mono">–{fmtKr(s.expenseVatDeductible)}</div>
                  <div className="font-medium text-workshop-text border-t border-workshop-border pt-1">Att betala</div>
                  <div className="font-bold text-amber-400 text-right font-mono border-t border-workshop-border pt-1">
                    {fmtKr(s.vatToPay)}
                  </div>
                </div>
              </div>
            </div>

            {/* Break-even */}
            <div className="surface p-5 space-y-4">
              <h2 className="font-semibold text-workshop-text flex items-center gap-2">
                <Target className="h-4 w-4 text-workshop-accent" />
                Break-even denna månad
              </h2>

              {s.totalExpenses === 0 ? (
                <p className="text-workshop-muted text-sm py-4 text-center">
                  Inga utgifter registrerade — lägg till fasta kostnader nedan
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-workshop-muted">Fasta kostnader</span>
                      <span className="text-workshop-text font-mono">{fmtKr(s.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-workshop-muted">Break-even omsättning</span>
                      <span className="text-workshop-text font-mono">{fmtKr(s.breakEvenRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-workshop-muted">Aktuell omsättning</span>
                      <span className="text-workshop-text font-mono">{fmtKr(s.revenue)}</span>
                    </div>
                  </div>

                  {/* Break-even progress bar */}
                  <div>
                    <div className="relative h-6 bg-workshop-elevated rounded-full overflow-hidden">
                      {/* Target line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                        style={{ left: `${Math.min(100, (1 / Math.max(s.revenueProgress * (1 / 1), 0.01)) * 100)}%` }}
                      />
                      {/* Revenue fill */}
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          s.revenueProgress >= 1 ? "bg-green-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(s.revenueProgress * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs">
                      <span className="text-workshop-muted">0 kr</span>
                      {s.revenueProgress < 1 ? (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {fmt(Math.round(s.breakEvenRevenue - s.revenue))} kr kvar till break-even
                        </span>
                      ) : (
                        <span className="text-green-400 flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3" />
                          {fmtKr(s.revenue - s.breakEvenRevenue)} över break-even!
                        </span>
                      )}
                      <span className="text-workshop-muted">{fmtKr(s.breakEvenRevenue)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Expenses by category */}
              {s.expensesByCategory.length > 0 && (
                <div className="border-t border-workshop-border pt-3 space-y-2">
                  <h3 className="text-xs text-workshop-muted uppercase tracking-wider">Utgifter per kategori</h3>
                  {s.expensesByCategory
                    .sort((a, b) => b.amount - a.amount)
                    .map((cat) => (
                      <div key={cat.category} className="flex items-center justify-between text-sm">
                        <span className="text-workshop-muted">
                          {EXPENSE_CATEGORY_LABELS[cat.category] ?? cat.category}
                        </span>
                        <span className="text-workshop-text font-mono">{fmtKr(cat.amount)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Expenses Table + Add Form ─── */}
          <ExpensesSection
            expenses={expenseList}
            mutate={mutateExpenses}
            year={year}
            month={month}
          />
        </>
      )}
    </div>
  );
}

// ─── KPI Card ───
function KpiCard({
  label, value, sub, icon: Icon, color, highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`surface p-4 flex items-start gap-3 ${highlight ? "border-red-600/50 border" : ""}`}>
      <div className={`p-2 rounded-lg bg-workshop-elevated ${color} flex-shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-workshop-muted">{label}</p>
        <p className="text-xl font-bold text-workshop-text font-mono tracking-tight">{value}</p>
        {sub && <p className="text-[10px] text-workshop-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Revenue Bar ───
function RevenueBar({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-workshop-muted">{label}</span>
        <span className="text-workshop-text font-mono">
          {fmtKr(value)} <span className="text-workshop-muted text-xs">({Math.round(pct)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-workshop-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Expenses Section ───
function ExpensesSection({
  expenses: expenseList,
  mutate,
  year,
  month,
}: {
  expenses: Expense[];
  mutate: () => void;
  year: number;
  month: number;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New expense form
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
    category: "other" as string,
    amount: "",
    vatAmount: "",
    vatDeductible: true,
    supplier: "",
    description: "",
    isRecurring: false,
  });

  const handleAdd = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ekonomi/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          vatAmount: form.vatAmount ? parseFloat(form.vatAmount) : 0,
        }),
      });
      if (res.ok) {
        setForm({
          date: form.date,
          category: "other",
          amount: "",
          vatAmount: "",
          vatDeductible: true,
          supplier: "",
          description: "",
          isRecurring: false,
        });
        setShowForm(false);
        mutate();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/ekonomi/expenses/${id}`, { method: "DELETE" });
      mutate();
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-workshop-text flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-workshop-accent" />
          Utgifter ({MONTHS[month - 1]})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Ny utgift
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-workshop-elevated rounded-lg p-4 space-y-3 border border-workshop-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-workshop-muted uppercase tracking-wider">Datum</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-workshop-bg border border-workshop-border rounded-md text-sm text-workshop-text focus:outline-none focus:border-workshop-accent"
              />
            </div>
            <div>
              <label className="text-[10px] text-workshop-muted uppercase tracking-wider">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-workshop-bg border border-workshop-border rounded-md text-sm text-workshop-text focus:outline-none focus:border-workshop-accent"
              >
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-workshop-muted uppercase tracking-wider">Belopp (exkl moms)</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full mt-1 px-3 py-2 bg-workshop-bg border border-workshop-border rounded-md text-sm text-workshop-text focus:outline-none focus:border-workshop-accent font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-workshop-muted uppercase tracking-wider">Moms (kr)</label>
              <input
                type="number"
                step="0.01"
                value={form.vatAmount}
                onChange={(e) => setForm({ ...form, vatAmount: e.target.value })}
                placeholder="0"
                className="w-full mt-1 px-3 py-2 bg-workshop-bg border border-workshop-border rounded-md text-sm text-workshop-text focus:outline-none focus:border-workshop-accent font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] text-workshop-muted uppercase tracking-wider">Beskrivning</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="T.ex. Månadshyra lokal"
                className="w-full mt-1 px-3 py-2 bg-workshop-bg border border-workshop-border rounded-md text-sm text-workshop-text focus:outline-none focus:border-workshop-accent"
              />
            </div>
            <div>
              <label className="text-[10px] text-workshop-muted uppercase tracking-wider">Leverantör</label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Valfritt"
                className="w-full mt-1 px-3 py-2 bg-workshop-bg border border-workshop-border rounded-md text-sm text-workshop-text focus:outline-none focus:border-workshop-accent"
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-workshop-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.vatDeductible}
                  onChange={(e) => setForm({ ...form, vatDeductible: e.target.checked })}
                  className="rounded border-workshop-border"
                />
                Avdragsgill moms
              </label>
              <label className="flex items-center gap-2 text-sm text-workshop-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                  className="rounded border-workshop-border"
                />
                Återkommande
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={saving || !form.description || !form.amount}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-40 text-white rounded-md transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Lägg till
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-workshop-muted hover:text-workshop-text transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Expense list */}
      {expenseList.length === 0 && !showForm && (
        <p className="text-center text-workshop-muted text-sm py-6">
          Inga utgifter registrerade denna månad
        </p>
      )}

      {expenseList.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-workshop-border">
                <th className="text-left py-2 text-xs text-workshop-muted font-medium uppercase tracking-wider">Datum</th>
                <th className="text-left py-2 text-xs text-workshop-muted font-medium uppercase tracking-wider">Kategori</th>
                <th className="text-left py-2 text-xs text-workshop-muted font-medium uppercase tracking-wider">Beskrivning</th>
                <th className="text-left py-2 text-xs text-workshop-muted font-medium uppercase tracking-wider">Leverantör</th>
                <th className="text-right py-2 text-xs text-workshop-muted font-medium uppercase tracking-wider">Belopp</th>
                <th className="text-right py-2 text-xs text-workshop-muted font-medium uppercase tracking-wider">Moms</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {expenseList.map((exp) => (
                <tr key={exp.id} className="border-b border-workshop-border/50 hover:bg-workshop-elevated/30">
                  <td className="py-2.5 text-workshop-text font-mono text-xs">{exp.date}</td>
                  <td className="py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-workshop-elevated text-workshop-muted">
                      {EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category}
                    </span>
                  </td>
                  <td className="py-2.5 text-workshop-text">
                    {exp.description}
                    {exp.isRecurring && (
                      <span className="ml-1.5 text-[10px] text-workshop-accent">↻</span>
                    )}
                  </td>
                  <td className="py-2.5 text-workshop-muted">{exp.supplier ?? "–"}</td>
                  <td className="py-2.5 text-workshop-text text-right font-mono">
                    {fmtKr(parseFloat(exp.amount))}
                  </td>
                  <td className="py-2.5 text-workshop-muted text-right font-mono">
                    {parseFloat(exp.vatAmount) > 0 ? fmtKr(parseFloat(exp.vatAmount)) : "–"}
                    {exp.vatDeductible && parseFloat(exp.vatAmount) > 0 && (
                      <span className="text-green-400 ml-1 text-[10px]">✓</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleDelete(exp.id)}
                      disabled={deletingId === exp.id}
                      className="p-1 text-workshop-muted hover:text-red-400 transition-colors"
                      title="Ta bort"
                    >
                      {deletingId === exp.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

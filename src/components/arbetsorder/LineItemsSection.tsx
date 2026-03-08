"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Wrench, Package, Trash2, Check, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PriceCompareBadge } from "@/components/procurement/PriceCompare";
import { SupplierSuggestion } from "./SupplierSuggestion";

interface Task {
  id: string;
  description: string;
  estimatedHours: number | null;
  actualHours: number | null;
  isCompleted: boolean;
}

interface PartUsed {
  id: string;
  partId?: string;
  partName: string;
  partNumber: string;
  quantity: number;
  unitCostPrice: number;
  unitSellPrice: number;
  vmbEligible: boolean;
  costBasis: number | null;
  notes: string | null;
}

interface Props {
  orderId: string;
  tasks: Task[];
  partsUsed: PartUsed[];
  hourlyRate: number;
}

export function LineItemsSection({ orderId, tasks, partsUsed, hourlyRate }: Props) {
  const router = useRouter();
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);

  // New task form
  const [taskDesc, setTaskDesc] = useState("");
  const [taskEstHours, setTaskEstHours] = useState("");
  const [submittingTask, setSubmittingTask] = useState(false);

  // New part form
  const [partSearch, setPartSearch] = useState("");
  const [debouncedPartSearch, setDebouncedPartSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState<any | null>(null);
  const [partQty, setPartQty] = useState("1");
  const [partSellPrice, setPartSellPrice] = useState("");
  const [partVmb, setPartVmb] = useState(false);
  const [partCostBasis, setPartCostBasis] = useState("");
  const [submittingPart, setSubmittingPart] = useState(false);

  // Quick-create new part (when not found in lager)
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPartNr, setQuickPartNr] = useState("");
  const [quickCost, setQuickCost] = useState("");
  const [quickSell, setQuickSell] = useState("");
  const [creatingPart, setCreatingPart] = useState(false);

  // Supplier suggestion popup state
  const [suggestionPart, setSuggestionPart] = useState<{
    partId: string;
    partName: string;
    partNumber: string;
    costPrice: number;
    sellPrice: number;
    quantity: number;
  } | null>(null);

  // Debounce part search input (300ms)
  useEffect(() => {
    if (!partSearch.trim() || partSearch.length < 2) {
      setDebouncedPartSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedPartSearch(partSearch), 300);
    return () => clearTimeout(timer);
  }, [partSearch]);

  // SWR for part search — cached, deduped
  const { data: partSearchData } = useSWR<{ data: any[] }>(
    debouncedPartSearch ? `/api/lager?search=${encodeURIComponent(debouncedPartSearch)}&limit=10` : null,
    { dedupingInterval: 2000 }
  );
  const partResults = partSearchData?.data ?? [];

  async function addTask() {
    if (!taskDesc.trim()) return;
    setSubmittingTask(true);
    try {
      const res = await fetch(`/api/arbetsorder/${orderId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: taskDesc,
          estimatedHours: taskEstHours ? parseFloat(taskEstHours) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte lägga till arbetsmoment.");
        return;
      }
      setTaskDesc("");
      setTaskEstHours("");
      setShowAddTask(false);
      router.refresh();
    } catch {
      alert("Nätverksfel — kunde inte lägga till arbetsmoment.");
    } finally {
      setSubmittingTask(false);
    }
  }

  async function toggleTask(taskId: string, isCompleted: boolean) {
    try {
      const res = await fetch(`/api/arbetsorder/${orderId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !isCompleted }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte uppdatera uppgift.");
        return;
      }
      router.refresh();
    } catch {
      alert("Nätverksfel — kunde inte uppdatera uppgift.");
    }
  }

  async function addPart() {
    if (!selectedPart) return;
    setSubmittingPart(true);
    try {
      const res = await fetch(`/api/arbetsorder/${orderId}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId: selectedPart.id,
          quantity: parseFloat(partQty) || 1,
          unitSellPrice: partSellPrice ? parseFloat(partSellPrice) : undefined,
          vmbEligible: partVmb,
          costBasis: partVmb && partCostBasis ? parseFloat(partCostBasis) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte lägga till del.");
        return;
      }
      // Capture part info BEFORE resetting state
      const addedPartInfo = {
        partId: selectedPart.id,
        partName: selectedPart.name,
        partNumber: selectedPart.partNumber,
        costPrice: parseFloat(selectedPart.costPrice) || 0,
        sellPrice: partSellPrice
          ? parseFloat(partSellPrice)
          : parseFloat(selectedPart.sellPrice) || 0,
        quantity: parseFloat(partQty) || 1,
      };
      setSelectedPart(null);
      setPartSearch("");
      setDebouncedPartSearch("");
      setPartQty("1");
      setPartSellPrice("");
      setPartVmb(false);
      setPartCostBasis("");
      setShowAddPart(false);
      router.refresh();
      // Show supplier suggestion popup (only if part has a cost price)
      if (addedPartInfo.costPrice > 0) {
        setSuggestionPart(addedPartInfo);
      }
    } catch {
      alert("Nätverksfel — kunde inte lägga till del.");
    } finally {
      setSubmittingPart(false);
    }
  }

  async function quickCreateAndAdd() {
    if (!quickName.trim()) return;
    setCreatingPart(true);
    try {
      // 1) Create part in lager
      const createRes = await fetch("/api/lager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickName.trim(),
          partNumber: quickPartNr.trim() || `SNABB-${Date.now()}`,
          costPrice: parseFloat(quickCost) || 0,
          sellPrice: parseFloat(quickSell) || 0,
          stockQty: 0,
          category: "general",
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => null);
        alert(body?.error ?? "Kunde inte skapa del.");
        return;
      }
      const { data: newPart } = await createRes.json();

      // 2) Add to work order
      const addRes = await fetch(`/api/arbetsorder/${orderId}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId: newPart.id,
          quantity: parseFloat(partQty) || 1,
          unitSellPrice: parseFloat(quickSell) || 0,
          vmbEligible: partVmb,
          costBasis: partVmb && partCostBasis ? parseFloat(partCostBasis) : undefined,
        }),
      });
      if (!addRes.ok) {
        const body = await addRes.json().catch(() => null);
        alert(body?.error ?? "Kunde inte lägga till del.");
        return;
      }

      // Capture info before reset
      const addedPartInfo = {
        partId: newPart.id,
        partName: quickName.trim(),
        partNumber: newPart.partNumber ?? quickPartNr.trim(),
        costPrice: parseFloat(quickCost) || 0,
        sellPrice: parseFloat(quickSell) || 0,
        quantity: parseFloat(partQty) || 1,
      };

      // Reset all
      setShowQuickCreate(false);
      setQuickName("");
      setQuickPartNr("");
      setQuickCost("");
      setQuickSell("");
      setPartSearch("");
      setDebouncedPartSearch("");
      setPartQty("1");
      setPartVmb(false);
      setPartCostBasis("");
      setShowAddPart(false);
      router.refresh();
      // Show supplier suggestion popup (only if part has a cost price)
      if (addedPartInfo.costPrice > 0) {
        setSuggestionPart(addedPartInfo);
      }
    } catch {
      alert("Nätverksfel — kunde inte skapa del.");
    } finally {
      setCreatingPart(false);
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const res = await fetch(`/api/arbetsorder/${orderId}/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte ta bort arbetsmoment.");
        return;
      }
      router.refresh();
    } catch {
      alert("Nätverksfel — kunde inte ta bort arbetsmoment.");
    }
  }

  async function deletePart(partLineId: string) {
    try {
      const res = await fetch(`/api/arbetsorder/${orderId}/parts/${partLineId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte ta bort del.");
        return;
      }
      router.refresh();
    } catch {
      alert("Nätverksfel — kunde inte ta bort del.");
    }
  }

  return (
    <div className="space-y-4">
      {/* LABOR / TASKS */}
      <div className="surface overflow-hidden">
        <div className="px-4 py-3 bg-workshop-elevated flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-workshop-accent" />
            <h3 className="font-medium text-workshop-text text-sm">Arbetsmoment</h3>
            <span className="text-xs text-workshop-muted">({tasks.length})</span>
          </div>
          <button
            onClick={() => setShowAddTask(!showAddTask)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-workshop-accent text-white rounded-md hover:bg-workshop-accent/80"
          >
            <Plus className="h-3 w-3" />
            Lägg till
          </button>
        </div>

        {/* Existing tasks */}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="px-4 py-3 border-t border-workshop-border flex items-center gap-3 group"
          >
            <button
              onClick={() => toggleTask(task.id, task.isCompleted)}
              className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                task.isCompleted
                  ? "bg-green-600 border-green-600 text-white"
                  : "border-workshop-border hover:border-workshop-accent"
              }`}
            >
              {task.isCompleted && <Check className="h-3.5 w-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${task.isCompleted ? "text-workshop-muted line-through" : "text-workshop-text"}`}>
                {task.description}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-workshop-muted">
              {task.estimatedHours != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.estimatedHours}h
                </span>
              )}
              {task.actualHours != null && (
                <span className="text-workshop-accent font-medium">
                  {task.actualHours}h faktisk
                </span>
              )}
              <span className="text-workshop-muted/50">
                {formatCurrency((task.actualHours ?? task.estimatedHours ?? 0) * hourlyRate)}
              </span>
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {tasks.length === 0 && !showAddTask && (
          <div className="px-4 py-6 text-center text-workshop-muted text-sm">
            Inga arbetsmoment tillagda
          </div>
        )}

        {/* Add task form */}
        {showAddTask && (
          <div className="px-4 py-3 border-t border-workshop-border bg-workshop-bg/50 space-y-3">
            <input
              type="text"
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="Beskrivning av arbetsmoment..."
              className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text text-sm focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && addTask()}
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-workshop-muted">Uppskattat (h):</label>
                <input
                  type="number"
                  step="0.5"
                  value={taskEstHours}
                  onChange={(e) => setTaskEstHours(e.target.value)}
                  className="w-20 px-2 py-1.5 bg-workshop-elevated border border-workshop-border rounded text-sm text-workshop-text"
                />
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowAddTask(false)}
                className="px-3 py-1.5 text-xs text-workshop-muted hover:text-workshop-text"
              >
                Avbryt
              </button>
              <button
                onClick={addTask}
                disabled={submittingTask || !taskDesc.trim()}
                className="px-4 py-1.5 bg-workshop-accent text-white text-xs rounded-md disabled:opacity-50"
              >
                {submittingTask ? "Sparar..." : "Lägg till"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PARTS */}
      <div className="surface overflow-hidden">
        <div className="px-4 py-3 bg-workshop-elevated flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-workshop-accent" />
            <h3 className="font-medium text-workshop-text text-sm">Material & delar</h3>
            <span className="text-xs text-workshop-muted">({partsUsed.length})</span>
          </div>
          <button
            onClick={() => setShowAddPart(!showAddPart)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-workshop-accent text-white rounded-md hover:bg-workshop-accent/80"
          >
            <Plus className="h-3 w-3" />
            Lägg till
          </button>
        </div>

        {/* Parts table */}
        {partsUsed.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-workshop-border text-xs text-workshop-muted">
                  <th className="px-4 py-2 text-left">Artikel</th>
                  <th className="px-2 py-2 text-right">Antal</th>
                  <th className="px-2 py-2 text-right">Inköp</th>
                  <th className="px-2 py-2 text-right">Kundpris</th>
                  <th className="px-2 py-2 text-right">Summa</th>
                  <th className="px-2 py-2 text-right">Marginal</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {partsUsed.map((p) => {
                  const lineTotal = p.quantity * p.unitSellPrice;
                  const lineCost = p.quantity * p.unitCostPrice;
                  const margin = lineTotal - lineCost;
                  return (
                    <tr key={p.id} className="border-t border-workshop-border group">
                      <td className="px-4 py-2">
                        <p className="text-workshop-text">{p.partName}</p>
                        <p className="text-xs text-workshop-muted font-mono">{p.partNumber}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.vmbEligible && (
                            <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">
                              VMB
                            </span>
                          )}
                          {p.partId && (
                            <PriceCompareBadge
                              partId={p.partId}
                              currentCostPrice={p.unitCostPrice}
                              currentSellPrice={p.unitSellPrice}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-workshop-text">{p.quantity}</td>
                      <td className="px-2 py-2 text-right text-workshop-muted">{formatCurrency(p.unitCostPrice)}</td>
                      <td className="px-2 py-2 text-right text-workshop-text">{formatCurrency(p.unitSellPrice)}</td>
                      <td className="px-2 py-2 text-right text-workshop-text font-medium">{formatCurrency(lineTotal)}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={margin >= 0 ? "text-green-400" : "text-red-400"}>
                          {formatCurrency(margin)}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => deletePart(p.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {partsUsed.length === 0 && !showAddPart && (
          <div className="px-4 py-6 text-center text-workshop-muted text-sm">
            Inga delar tillagda
          </div>
        )}

        {/* Add part form */}
        {showAddPart && (
          <div className="px-4 py-3 border-t border-workshop-border bg-workshop-bg/50 space-y-3">
            {!selectedPart ? (
              <>
                <div>
                  <input
                    type="text"
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                    placeholder="Sök artikelnamn eller nummer... (minst 2 tecken)"
                    className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text text-sm"
                    autoFocus
                  />
                </div>
                {partResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {partResults.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPart(p);
                          setPartSellPrice(p.sellPrice ?? "0");
                          setPartVmb(p.vmbEligible ?? false);
                          setPartCostBasis(p.costPrice ?? "0");
                          setShowQuickCreate(false);
                        }}
                        className="w-full text-left px-3 py-2 bg-workshop-elevated hover:bg-workshop-border rounded-md flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm text-workshop-text">{p.name}</p>
                          <p className="text-xs text-workshop-muted font-mono">{p.partNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-workshop-muted">Inköp: {formatCurrency(p.costPrice)}</p>
                          <p className="text-sm text-workshop-text">{formatCurrency(p.sellPrice)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick-create: show when no results or user wants to add new */}
                {debouncedPartSearch.length >= 2 && partResults.length === 0 && !showQuickCreate && (
                  <div className="text-center py-2 space-y-2">
                    <p className="text-xs text-workshop-muted">Ingen del hittades i lagret</p>
                    <button
                      onClick={() => { setShowQuickCreate(true); setQuickName(partSearch); }}
                      className="text-xs text-workshop-accent hover:underline"
                    >
                      + Skapa ny del &quot;{partSearch}&quot;
                    </button>
                  </div>
                )}
                {partResults.length > 0 && !showQuickCreate && (
                  <button
                    onClick={() => { setShowQuickCreate(true); setQuickName(partSearch); }}
                    className="text-xs text-workshop-accent hover:underline"
                  >
                    + Skapa ny del istället
                  </button>
                )}

                {/* Quick-create form */}
                {showQuickCreate && (
                  <div className="bg-workshop-elevated border border-workshop-border rounded-md p-3 space-y-3">
                    <p className="text-xs font-medium text-workshop-text">Ny del (snabb)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-workshop-muted">Namn *</label>
                        <input
                          type="text"
                          value={quickName}
                          onChange={(e) => setQuickName(e.target.value)}
                          placeholder="t.ex. Motorolja 5W-30"
                          className="w-full px-2 py-1.5 bg-workshop-bg border border-workshop-border rounded text-sm text-workshop-text"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-workshop-muted">Artikelnr</label>
                        <input
                          type="text"
                          value={quickPartNr}
                          onChange={(e) => setQuickPartNr(e.target.value)}
                          placeholder="Valfritt"
                          className="w-full px-2 py-1.5 bg-workshop-bg border border-workshop-border rounded text-sm text-workshop-text"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-workshop-muted">Inköpspris</label>
                        <input
                          type="number"
                          step="0.01"
                          value={quickCost}
                          onChange={(e) => setQuickCost(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-workshop-bg border border-workshop-border rounded text-sm text-workshop-text"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-workshop-muted">Kundpris</label>
                        <input
                          type="number"
                          step="0.01"
                          value={quickSell}
                          onChange={(e) => setQuickSell(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-workshop-bg border border-workshop-border rounded text-sm text-workshop-text"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowQuickCreate(false)}
                        className="px-3 py-1.5 text-xs text-workshop-muted"
                      >
                        Avbryt
                      </button>
                      <button
                        onClick={quickCreateAndAdd}
                        disabled={creatingPart || !quickName.trim()}
                        className="px-4 py-1.5 bg-workshop-accent text-white text-xs rounded-md disabled:opacity-50"
                      >
                        {creatingPart ? "Skapar..." : "Skapa & lägg till"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-workshop-elevated p-3 rounded-md">
                  <div>
                    <p className="text-sm text-workshop-text font-medium">{selectedPart.name}</p>
                    <p className="text-xs text-workshop-muted font-mono">{selectedPart.partNumber}</p>
                  </div>
                  <button
                    onClick={() => setSelectedPart(null)}
                    className="text-xs text-workshop-muted hover:text-workshop-text"
                  >
                    Byt
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-workshop-muted">Antal</label>
                    <input
                      type="number"
                      step="1"
                      value={partQty}
                      onChange={(e) => setPartQty(e.target.value)}
                      className="w-full px-2 py-2 bg-workshop-elevated border border-workshop-border rounded text-sm text-workshop-text"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-workshop-muted">Inköpspris</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedPart.costPrice ?? "0"}
                      disabled
                      className="w-full px-2 py-2 bg-workshop-bg border border-workshop-border rounded text-sm text-workshop-muted"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-workshop-muted">Kundpris *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={partSellPrice}
                      onChange={(e) => setPartSellPrice(e.target.value)}
                      className="w-full px-2 py-2 bg-workshop-elevated border border-workshop-border rounded text-sm text-workshop-text"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={partVmb}
                        onChange={(e) => setPartVmb(e.target.checked)}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span className="text-xs text-workshop-muted">VMB</span>
                    </label>
                  </div>
                </div>
                {partVmb && (
                  <div className="bg-purple-950/30 border border-purple-900/50 rounded-md p-3">
                    <label className="text-xs text-purple-300">Inköpspris (VMB kostnadsbas)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={partCostBasis}
                      onChange={(e) => setPartCostBasis(e.target.value)}
                      className="w-full mt-1 px-2 py-2 bg-workshop-elevated border border-purple-900 rounded text-sm text-workshop-text"
                    />
                    <p className="text-xs text-purple-400 mt-1">
                      VMB-moms: {formatCurrency(
                        Math.max(0, ((parseFloat(partSellPrice) || 0) - (parseFloat(partCostBasis) || 0)) * (parseFloat(partQty) || 1) * 0.20)
                      )}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowAddPart(false); setSelectedPart(null); }}
                    className="px-3 py-1.5 text-xs text-workshop-muted"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={addPart}
                    disabled={submittingPart}
                    className="px-4 py-1.5 bg-workshop-accent text-white text-xs rounded-md disabled:opacity-50"
                  >
                    {submittingPart ? "Sparar..." : "Lägg till del"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Supplier suggestion popup — shown after adding a part */}
      {suggestionPart && (
        <SupplierSuggestion
          partId={suggestionPart.partId}
          partName={suggestionPart.partName}
          partNumber={suggestionPart.partNumber}
          currentCostPrice={suggestionPart.costPrice}
          currentSellPrice={suggestionPart.sellPrice}
          workOrderId={orderId}
          quantity={suggestionPart.quantity}
          onClose={() => setSuggestionPart(null)}
          onOrderComplete={() => {
            setSuggestionPart(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

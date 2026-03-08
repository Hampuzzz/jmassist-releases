"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Check, Package, ClipboardList } from "lucide-react";

interface PurchaseLine {
  partNumber: string;
  partName: string;
  quantity: string;
  unitCostPrice: string;
  sellPrice: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface WorkOrderOption {
  id: string;
  orderNumber: string;
  vehicleRegNr: string;
  customerName: string;
}

const emptyLine = (): PurchaseLine => ({
  partNumber: "",
  partName: "",
  quantity: "1",
  unitCostPrice: "",
  sellPrice: "",
});

export function RegisterPurchaseForm() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [workOrderId, setWorkOrderId] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Fetch suppliers
  useEffect(() => {
    fetch("/api/leverantorer")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.data) setSuppliers(data.data);
      })
      .catch(() => {});
  }, []);

  // Fetch active work orders
  useEffect(() => {
    fetch("/api/arbetsorder?limit=50")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.data) {
          setWorkOrders(
            data.data
              .filter((o: any) => !["finished", "cancelled"].includes(o.status))
              .map((o: any) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                vehicleRegNr: o.vehicleRegNr ?? "",
                customerName: [o.customerFirst, o.customerLast].filter(Boolean).join(" ") || o.customerCo || "",
              })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const updateLine = useCallback((index: number, field: keyof PurchaseLine, value: string) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const validLines = lines.filter((l) => l.partNumber.trim() && l.partName.trim());
    if (validLines.length === 0) {
      setError("Fyll i minst en komplett artikelrad.");
      return;
    }

    for (const l of validLines) {
      if (!parseFloat(l.quantity) || parseFloat(l.quantity) <= 0) {
        setError(`Antal måste vara > 0 för ${l.partNumber}`);
        return;
      }
      if (l.unitCostPrice === "" || parseFloat(l.unitCostPrice) < 0) {
        setError(`Inköpspris krävs för ${l.partNumber}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inkop/registrera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId || null,
          workOrderId: workOrderId || null,
          reference: reference || null,
          lines: validLines.map((l) => ({
            partNumber: l.partNumber.trim(),
            partName: l.partName.trim(),
            quantity: parseFloat(l.quantity),
            unitCostPrice: parseFloat(l.unitCostPrice),
            sellPrice: l.sellPrice ? parseFloat(l.sellPrice) : null,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Registrering misslyckades");
      }

      setSuccess(true);
      // Reset form
      setSupplierId("");
      setWorkOrderId("");
      setReference("");
      setLines([emptyLine()]);

      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = "px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted text-sm focus:outline-none focus:ring-2 focus:ring-workshop-accent";

  return (
    <div className="surface p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="h-5 w-5 text-workshop-accent" />
        <h2 className="text-lg font-bold text-workshop-text">Registrera inköp</h2>
      </div>
      <p className="text-workshop-muted text-sm">
        Har du handlat hos en leverantör? Registrera artiklarna här så uppdateras lagret automatiskt.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Supplier + Work Order + Reference */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-workshop-muted mb-1">Leverantör</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={inputClasses + " w-full"}
            >
              <option value="">Välj leverantör...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-workshop-muted mb-1">Arbetsorder (valfritt)</label>
            <select
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              className={inputClasses + " w-full"}
            >
              <option value="">Ingen — lägg i lager</option>
              {workOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} · {o.vehicleRegNr} · {o.customerName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-workshop-muted mb-1">Referens / kvittonr</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="t.ex. INV-12345"
              className={inputClasses + " w-full"}
            />
          </div>
        </div>

        {/* Hint about work order */}
        {workOrderId && (
          <div className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-2">
            Artiklarna läggs automatiskt på arbetsorder och dras från lagret.
          </div>
        )}

        {/* Article lines */}
        <div>
          <label className="block text-xs text-workshop-muted mb-2 uppercase tracking-wider font-medium">Artikelrader</label>
          <div className="space-y-2">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[1fr_1.5fr_80px_100px_100px_36px] gap-2 text-xs text-workshop-muted px-1">
              <span>Artikelnr</span>
              <span>Namn</span>
              <span>Antal</span>
              <span>Inköpspris</span>
              <span>Försälj.pris</span>
              <span></span>
            </div>

            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_80px_100px_100px_36px] gap-2 items-center">
                <input
                  type="text"
                  value={line.partNumber}
                  onChange={(e) => updateLine(i, "partNumber", e.target.value)}
                  placeholder="ABC123"
                  className={inputClasses + " w-full font-mono"}
                />
                <input
                  type="text"
                  value={line.partName}
                  onChange={(e) => updateLine(i, "partName", e.target.value)}
                  placeholder="Bromsbelägg fram"
                  className={inputClasses + " w-full"}
                />
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, "quantity", e.target.value)}
                  placeholder="1"
                  min="0.01"
                  step="any"
                  className={inputClasses + " w-full text-center"}
                />
                <input
                  type="number"
                  value={line.unitCostPrice}
                  onChange={(e) => updateLine(i, "unitCostPrice", e.target.value)}
                  placeholder="0 kr"
                  min="0"
                  step="any"
                  className={inputClasses + " w-full text-right"}
                />
                <input
                  type="number"
                  value={line.sellPrice}
                  onChange={(e) => updateLine(i, "sellPrice", e.target.value)}
                  placeholder="Auto"
                  min="0"
                  step="any"
                  className={inputClasses + " w-full text-right"}
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 1}
                  className="p-2 text-workshop-muted hover:text-red-400 disabled:opacity-30 transition-colors"
                  title="Ta bort rad"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs text-workshop-accent hover:bg-workshop-elevated rounded-md transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Lägg till rad
          </button>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-200 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            Inköp registrerat! Artiklarna har lagts till i lagret.
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            Registrera inköp
          </button>
        </div>
      </form>
    </div>
  );
}

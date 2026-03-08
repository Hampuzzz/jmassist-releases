"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Save, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { VhcItemRow, type VhcItemState } from "./VhcItemRow";
import { VHC_CATEGORIES } from "@/lib/vhc/default-checklist";

interface Props {
  vhcId: string;
  workOrderId: string;
  initialItems: VhcItemState[];
  initialStatus: string;
  customerPhone?: string;
}

export function VhcChecklist({ vhcId, workOrderId, initialItems, initialStatus, customerPhone }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<VhcItemState[]>(initialItems);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Autosave: debounce 1.5s after changes
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveItems();
    }, 1500);
  }, []);

  // Save items to API
  const saveItems = async () => {
    if (!dirtyRef.current) return;
    setSaving(true);
    try {
      const payload = items.map((item) => ({
        id: item.id,
        severity: item.severity,
        comment: item.comment || null,
        estimatedCost: item.estimatedCost || null,
        mediaUrls: item.mediaUrls,
      }));
      await fetch(`/api/vhc/${vhcId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      dirtyRef.current = false;
      setLastSaved(new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Handle item change
  const handleChange = useCallback(
    (id: string, field: keyof VhcItemState, value: unknown) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
      );
      scheduleSave();
    },
    [scheduleSave],
  );

  // Send to customer via SMS
  const handleSend = async () => {
    // Save first
    await saveItems();
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/vhc/${vhcId}/send`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setStatus("sent");
        setSendResult({ success: true, message: json.message ?? "SMS skickat!" });
      } else {
        setSendResult({ success: false, message: json.error ?? "Kunde inte skicka SMS" });
      }
    } catch {
      setSendResult({ success: false, message: "Nätverksfel" });
    } finally {
      setSending(false);
    }
  };

  // Group items by category
  const grouped = VHC_CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((item) => item.category === cat.key),
  })).filter((cat) => cat.items.length > 0);

  // Counts
  const greenCount = items.filter((i) => i.severity === "green").length;
  const yellowCount = items.filter((i) => i.severity === "yellow").length;
  const redCount = items.filter((i) => i.severity === "red").length;
  const totalCost = items
    .filter((i) => i.severity !== "green" && i.estimatedCost)
    .reduce((sum, i) => sum + (parseFloat(i.estimatedCost) || 0), 0);

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Summary bar */}
      <div className="sticky top-0 z-10 bg-workshop-card border-b border-workshop-border p-3 flex items-center gap-4 shadow-md">
        <div className="flex gap-3 text-sm font-medium">
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle2 className="w-4 h-4" /> {greenCount}
          </span>
          <span className="flex items-center gap-1 text-yellow-400">
            <AlertTriangle className="w-4 h-4" /> {yellowCount}
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <XCircle className="w-4 h-4" /> {redCount}
          </span>
        </div>

        {totalCost > 0 && (
          <span className="text-sm text-workshop-muted ml-auto">
            Uppskattad kostnad: <strong className="text-workshop-text">{totalCost.toLocaleString("sv-SE")} kr</strong>
          </span>
        )}

        <div className="flex items-center gap-1 text-xs text-workshop-muted">
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {lastSaved && !saving && <span>Sparat {lastSaved}</span>}
        </div>
      </div>

      {/* Category sections */}
      {grouped.map((cat) => (
        <div key={cat.key} className="mt-4">
          <h3 className="text-sm font-semibold text-workshop-muted uppercase tracking-wider px-2 mb-1">
            {cat.label}
          </h3>
          <div className="bg-workshop-card rounded-lg border border-workshop-border">
            {cat.items.map((item) => (
              <VhcItemRow
                key={item.id}
                item={item}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-workshop-card border-t border-workshop-border p-4 flex gap-3 justify-center z-20">
        <button
          type="button"
          onClick={saveItems}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-workshop-dark border border-workshop-border text-workshop-text font-medium hover:bg-workshop-border transition-colors touch-manipulation"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Spara
        </button>

        {(yellowCount > 0 || redCount > 0) && status === "draft" && (
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !customerPhone}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors touch-manipulation"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Skicka till kund
          </button>
        )}

        {status === "sent" && (
          <span className="flex items-center gap-2 px-6 py-3 text-green-400 font-medium">
            <CheckCircle2 className="w-5 h-5" /> Skickat till kund
          </span>
        )}
      </div>

      {/* Send result toast */}
      {sendResult && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            sendResult.success ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {sendResult.message}
        </div>
      )}
    </div>
  );
}

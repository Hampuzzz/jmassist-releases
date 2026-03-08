"use client";

import { useState, useTransition } from "react";
import { Clock, Save, Loader2 } from "lucide-react";

interface HourRow {
  id: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: string;
}

const DAY_NAMES: Record<string, string> = {
  "1": "Måndag",
  "2": "Tisdag",
  "3": "Onsdag",
  "4": "Torsdag",
  "5": "Fredag",
  "6": "Lördag",
  "7": "Söndag",
};

export default function OpeningHoursForm({ initial }: { initial: HourRow[] }) {
  const [rows, setRows] = useState<HourRow[]>(initial);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function update(id: string, field: keyof HourRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
    setMessage(null);
  }

  function toggleClosed(id: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, isClosed: r.isClosed === "true" ? "false" : "true" }
          : r,
      ),
    );
    setMessage(null);
  }

  function handleSave() {
    startSaving(async () => {
      try {
        const res = await fetch("/api/oppettider", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hours: rows }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMessage({ type: "err", text: err.error ?? "Kunde inte spara" });
          return;
        }
        setMessage({ type: "ok", text: "Öppettider sparade!" });
      } catch {
        setMessage({ type: "err", text: "Nätverksfel" });
      }
    });
  }

  return (
    <div className="surface">
      <div className="p-4 border-b border-workshop-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-workshop-text">Standardöppettider</h2>
          <p className="text-xs text-workshop-muted">Klicka på tiderna för att ändra, eller toggla Stängt</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-workshop-accent text-white rounded-lg text-sm font-medium hover:bg-workshop-accent/80 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Spara
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-workshop-border bg-workshop-elevated">
            <th className="px-4 py-2 text-left text-xs text-workshop-muted w-32">Dag</th>
            <th className="px-4 py-2 text-left text-xs text-workshop-muted w-36">Öppnar</th>
            <th className="px-4 py-2 text-left text-xs text-workshop-muted w-36">Stänger</th>
            <th className="px-4 py-2 text-left text-xs text-workshop-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const closed = h.isClosed === "true";
            return (
              <tr key={h.id} className="border-b border-workshop-border">
                <td className="px-4 py-2 font-medium text-workshop-text">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-workshop-muted" />
                    {DAY_NAMES[h.dayOfWeek] ?? h.dayOfWeek}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="time"
                    value={h.openTime?.substring(0, 5) ?? "08:00"}
                    onChange={(e) => update(h.id, "openTime", e.target.value + ":00")}
                    disabled={closed}
                    className="bg-workshop-bg border border-workshop-border rounded px-2 py-1 text-sm text-workshop-text font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-workshop-accent"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="time"
                    value={h.closeTime?.substring(0, 5) ?? "17:00"}
                    onChange={(e) => update(h.id, "closeTime", e.target.value + ":00")}
                    disabled={closed}
                    className="bg-workshop-bg border border-workshop-border rounded px-2 py-1 text-sm text-workshop-text font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-workshop-accent"
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleClosed(h.id)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                      closed
                        ? "bg-red-900/40 text-red-300 hover:bg-red-900/60"
                        : "bg-green-900/40 text-green-300 hover:bg-green-900/60"
                    }`}
                  >
                    {closed ? "Stängt" : "Öppet"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {message && (
        <div className={`px-4 py-2 text-sm ${
          message.type === "ok" ? "text-green-400" : "text-red-400"
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

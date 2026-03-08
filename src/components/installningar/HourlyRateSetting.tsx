"use client";

import { useState, useEffect } from "react";
import { Clock, Check } from "lucide-react";

export function HourlyRateSetting() {
  const [rate, setRate]       = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/installningar")
      .then(r => r.json())
      .then(d => {
        const val = d.data?.workshop_hourly_rate ?? "";
        setRate(val);
        setOriginal(val);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    const res = await fetch("/api/installningar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "workshop_hourly_rate", value: rate || "850" }),
    });
    setBusy(false);
    if (res.ok) {
      setOriginal(rate);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) return null;

  const dirty = rate !== original;

  return (
    <div className="surface p-4 flex items-center gap-4">
      <div className="p-2 bg-workshop-elevated rounded-lg">
        <Clock className="h-5 w-5 text-workshop-accent" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-workshop-text">Timpris</p>
        <p className="text-sm text-workshop-muted">
          Verkstadens timpris som används vid fakturering
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="number"
            step="1"
            min="0"
            placeholder="850"
            value={rate}
            onChange={e => setRate(e.target.value)}
            className="w-28 bg-workshop-elevated border border-workshop-border rounded-md px-3 py-1.5 pr-12 text-sm text-workshop-text text-right focus:outline-none focus:border-workshop-accent"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-workshop-muted">kr/h</span>
        </div>
        {dirty && (
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-workshop-accent text-black rounded-md text-xs font-medium disabled:opacity-50"
          >
            {busy ? "Sparar…" : "Spara"}
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3.5 w-3.5" /> Sparat
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface BlockedPeriod {
  id: string;
  title: string;
  blockStart: string;
  blockEnd: string;
}

export default function BlockedPeriodForm({ blocks }: { blocks: BlockedPeriod[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [title, setTitle] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");

  function handleAdd() {
    if (!title || !blockStart || !blockEnd) {
      setMessage({ type: "err", text: "Alla fält krävs" });
      return;
    }
    startSaving(async () => {
      try {
        const res = await fetch("/api/blocked-periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            blockStart: new Date(blockStart).toISOString(),
            blockEnd: new Date(blockEnd).toISOString(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMessage({ type: "err", text: err.error ?? "Kunde inte spara" });
          return;
        }
        setMessage({ type: "ok", text: "Stängning tillagd!" });
        setTitle("");
        setBlockStart("");
        setBlockEnd("");
        setShowForm(false);
        router.refresh();
      } catch {
        setMessage({ type: "err", text: "Nätverksfel" });
      }
    });
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/blocked-periods/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "ok", text: "Stängning borttagen" });
        router.refresh();
      } else {
        setMessage({ type: "err", text: "Kunde inte ta bort" });
      }
    } catch {
      setMessage({ type: "err", text: "Nätverksfel" });
    } finally {
      setDeleting(null);
    }
  }

  function formatDT(d: string) {
    try { return new Date(d).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }); }
    catch { return d; }
  }

  return (
    <div className="surface">
      <div className="p-4 border-b border-workshop-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-workshop-text">Manuella stängningar</h2>
          <p className="text-xs text-workshop-muted">Helgdagar, personalmöten, etc.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-workshop-accent text-white rounded-lg text-sm font-medium hover:bg-workshop-accent/80 transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Avbryt" : "Lägg till"}
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-workshop-border bg-workshop-elevated/50 space-y-3">
          <div>
            <label className="text-xs text-workshop-muted block mb-1">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="t.ex. Midsommar, Personalmöte"
              className="w-full bg-workshop-bg border border-workshop-border rounded px-3 py-2 text-sm text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-workshop-muted block mb-1">Från</label>
              <input
                type="datetime-local"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="w-full bg-workshop-bg border border-workshop-border rounded px-3 py-2 text-sm text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent"
              />
            </div>
            <div>
              <label className="text-xs text-workshop-muted block mb-1">Till</label>
              <input
                type="datetime-local"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full bg-workshop-bg border border-workshop-border rounded px-3 py-2 text-sm text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-workshop-accent text-white rounded-lg text-sm font-medium hover:bg-workshop-accent/80 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Spara stängning
          </button>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="text-center text-workshop-muted text-sm py-6">
          Inga manuella stängningar inlagda
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-border bg-workshop-elevated">
              <th className="px-4 py-2 text-left text-xs text-workshop-muted">Titel</th>
              <th className="px-4 py-2 text-left text-xs text-workshop-muted">Från</th>
              <th className="px-4 py-2 text-left text-xs text-workshop-muted">Till</th>
              <th className="px-4 py-2 text-right text-xs text-workshop-muted w-20"></th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id} className="border-b border-workshop-border">
                <td className="px-4 py-2 font-medium text-workshop-text">{b.title}</td>
                <td className="px-4 py-2 text-workshop-muted">{formatDT(b.blockStart)}</td>
                <td className="px-4 py-2 text-workshop-muted">{formatDT(b.blockEnd)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleDelete(b.id)}
                    disabled={deleting === b.id}
                    className="text-red-400 hover:text-red-300 p-1 disabled:opacity-50"
                    title="Ta bort"
                  >
                    {deleting === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {message && (
        <div className={`px-4 py-2 text-sm ${message.type === "ok" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

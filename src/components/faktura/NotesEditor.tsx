"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";

interface Props {
  invoiceId: string;
  isDraft: boolean;
  initialNotes: string;
}

export function NotesEditor({ invoiceId, isDraft, initialNotes }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/faktura/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Kunde inte spara anteckningar.");
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

  if (!editing) {
    return (
      <div className="no-print">
        {isDraft && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm text-workshop-accent hover:text-workshop-accent-hover transition-colors mt-1"
          >
            <Pencil className="h-3.5 w-3.5" />
            Redigera anteckningar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="no-print space-y-3 surface p-4 border border-workshop-accent/30 rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-workshop-text">
          Redigera anteckningar
        </h4>
        <button
          onClick={() => { setEditing(false); setNotes(initialNotes); }}
          className="p-1 rounded-md hover:bg-workshop-elevated text-workshop-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Skriv anteckningar här..."
        className="w-full px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-sm text-workshop-text resize-y"
      />

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => { setEditing(false); setNotes(initialNotes); }}
          className="px-3 py-1.5 text-sm text-workshop-muted hover:text-workshop-text transition-colors"
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Sparar..." : "Spara"}
        </button>
      </div>
    </div>
  );
}

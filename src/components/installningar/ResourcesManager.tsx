"use client";

import { useState, useTransition } from "react";
import { Wrench, Plus, Save, Loader2, Trash2, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface Resource {
  id: string;
  name: string;
  resourceType: string;
  isActive: boolean;
  notes: string | null;
  sortOrder: number;
}

const TYPE_OPTIONS = [
  { value: "lift", label: "Lyft" },
  { value: "workstation", label: "Arbetsstation" },
  { value: "bay", label: "Plats" },
];

const TYPE_LABELS: Record<string, string> = {
  lift: "Lyft",
  workstation: "Arbetsstation",
  bay: "Plats",
};

export default function ResourcesManager({ initial }: { initial: Resource[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Resource[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // New resource form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("lift");
  const [newNotes, setNewNotes] = useState("");

  // Inline edit state
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editNotes, setEditNotes] = useState("");

  function startEdit(r: Resource) {
    setEditingId(r.id);
    setEditName(r.name);
    setEditType(r.resourceType);
    setEditNotes(r.notes ?? "");
    setShowAdd(false);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleSaveEdit(id: string) {
    startSaving(async () => {
      try {
        const res = await fetch(`/api/resurser/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, resourceType: editType, notes: editNotes || null }),
        });
        if (!res.ok) {
          setMessage({ type: "err", text: "Kunde inte spara" });
          return;
        }
        const { data } = await res.json();
        setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
        setEditingId(null);
        setMessage({ type: "ok", text: "Resurs uppdaterad!" });
      } catch {
        setMessage({ type: "err", text: "Nätverksfel" });
      }
    });
  }

  function handleToggleActive(id: string, current: boolean) {
    startSaving(async () => {
      try {
        const res = await fetch(`/api/resurser/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !current }),
        });
        if (!res.ok) {
          setMessage({ type: "err", text: "Kunde inte ändra status" });
          return;
        }
        setItems((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isActive: !current } : r)),
        );
        setMessage({ type: "ok", text: !current ? "Resurs aktiverad" : "Resurs inaktiverad" });
      } catch {
        setMessage({ type: "err", text: "Nätverksfel" });
      }
    });
  }

  function handleAdd() {
    if (!newName.trim()) {
      setMessage({ type: "err", text: "Namn krävs" });
      return;
    }
    startSaving(async () => {
      try {
        const res = await fetch("/api/resurser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName.trim(),
            resourceType: newType,
            notes: newNotes || null,
            sortOrder: items.length,
          }),
        });
        if (!res.ok) {
          setMessage({ type: "err", text: "Kunde inte skapa" });
          return;
        }
        const { data } = await res.json();
        setItems((prev) => [...prev, data]);
        setNewName("");
        setNewType("lift");
        setNewNotes("");
        setShowAdd(false);
        setMessage({ type: "ok", text: "Resurs skapad!" });
      } catch {
        setMessage({ type: "err", text: "Nätverksfel" });
      }
    });
  }

  function handleDelete(id: string) {
    startSaving(async () => {
      try {
        const res = await fetch(`/api/resurser/${id}`, { method: "DELETE" });
        if (!res.ok) {
          setMessage({ type: "err", text: "Kunde inte ta bort (kan vara kopplad till bokningar)" });
          return;
        }
        setItems((prev) => prev.filter((r) => r.id !== id));
        setMessage({ type: "ok", text: "Resurs borttagen" });
      } catch {
        setMessage({ type: "err", text: "Nätverksfel" });
      }
    });
  }

  return (
    <div className="surface overflow-hidden">
      <div className="p-4 border-b border-workshop-border flex items-center justify-between">
        <div>
          <p className="text-sm text-workshop-muted">
            Resurser avgör hur många fordon som kan hanteras samtidigt.
            Klicka på en rad för att redigera.
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); setMessage(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-workshop-accent text-white rounded-lg text-sm font-medium hover:bg-workshop-accent/80 transition-colors"
        >
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAdd ? "Avbryt" : "Ny resurs"}
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-workshop-border bg-workshop-elevated/50 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-workshop-muted block mb-1">Namn</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="t.ex. Lyft 3"
                className="w-full bg-workshop-bg border border-workshop-border rounded px-3 py-2 text-sm text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent"
              />
            </div>
            <div>
              <label className="text-xs text-workshop-muted block mb-1">Typ</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full bg-workshop-bg border border-workshop-border rounded px-3 py-2 text-sm text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-workshop-muted block mb-1">Anteckningar</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Valfritt"
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
            Lägg till
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-workshop-border bg-workshop-elevated">
            <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Namn</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Typ</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Anteckningar</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase w-24">Åtgärder</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) =>
            editingId === r.id ? (
              <tr key={r.id} className="border-b border-workshop-border bg-workshop-elevated/30">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-workshop-bg border border-workshop-border rounded px-2 py-1 text-sm text-workshop-text w-full focus:outline-none focus:ring-1 focus:ring-workshop-accent"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="bg-workshop-bg border border-workshop-border rounded px-2 py-1 text-sm text-workshop-text focus:outline-none focus:ring-1 focus:ring-workshop-accent"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="bg-workshop-bg border border-workshop-border rounded px-2 py-1 text-sm text-workshop-text w-full focus:outline-none focus:ring-1 focus:ring-workshop-accent"
                  />
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.isActive ? "bg-green-900/40 text-green-300" : "bg-zinc-700 text-zinc-400"
                  }`}>
                    {r.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleSaveEdit(r.id)} disabled={saving}
                      className="text-green-400 hover:text-green-300 p-1 disabled:opacity-50" title="Spara">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button onClick={cancelEdit} className="text-workshop-muted hover:text-workshop-text p-1" title="Avbryt">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={r.id}
                className="border-b border-workshop-border hover:bg-workshop-elevated/50 cursor-pointer"
                onClick={() => startEdit(r)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-workshop-muted" />
                    <span className="font-medium text-workshop-text">{r.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-workshop-muted">
                  {TYPE_LABELS[r.resourceType] ?? r.resourceType}
                </td>
                <td className="px-4 py-3 text-workshop-muted text-xs">{r.notes ?? "–"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(r.id, r.isActive); }}
                    className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${
                      r.isActive
                        ? "bg-green-900/40 text-green-300 hover:bg-green-900/60"
                        : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                    }`}
                    title={r.isActive ? "Klicka för att inaktivera" : "Klicka för att aktivera"}
                  >
                    {r.isActive ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                    {r.isActive ? "Aktiv" : "Inaktiv"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                    className="text-red-400/60 hover:text-red-400 p-1"
                    title="Ta bort"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-workshop-muted text-sm">Inga resurser konfigurerade</p>
        </div>
      )}

      {message && (
        <div className={`px-4 py-2 text-sm ${message.type === "ok" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

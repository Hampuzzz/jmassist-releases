"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Truck, Save, Loader2, Package, Phone, Mail, MapPin,
  Pencil, X, Trash2,
} from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  orgNr: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  integrationType: string | null;
  defaultLeadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Part = {
  id: string;
  partNumber: string;
  name: string;
  category: string | null;
  costPrice: string;
  sellPrice: string;
  stockQty: string;
};

export default function LeverantorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/leverantorer/${id}`);
        if (!res.ok) { setError("Leverantören hittades inte"); setLoading(false); return; }
        const { data } = await res.json();
        setSupplier(data);
        setForm(data);

        // Load parts for this supplier
        const pRes = await fetch(`/api/lager?supplier_id=${id}&limit=100`);
        if (pRes.ok) {
          const { data: pData } = await pRes.json();
          setParts(pData ?? []);
        }
      } catch {
        setError("Kunde inte ladda leverantörsdata");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/leverantorer/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Kunde inte spara.");
        return;
      }
      const { data } = await res.json();
      setSupplier(data);
      setEditing(false);
    } catch {
      setError("Nätverksfel vid sparning.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Är du säker på att du vill ta bort denna leverantör? Artiklar behålls men tappar kopplingen.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/leverantorer/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/lager/leverantorer");
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte ta bort leverantör.");
      }
    } catch {
      alert("Nätverksfel — kunde inte ta bort.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-workshop-accent" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Truck className="h-12 w-12 text-workshop-muted mx-auto mb-4" />
        <h2 className="text-xl font-bold text-workshop-text mb-2">Leverantören hittades inte</h2>
        <Link href="/lager/leverantorer" className="text-workshop-accent hover:underline text-sm">
          Tillbaka till leverantörer
        </Link>
      </div>
    );
  }

  const inputClasses = "w-full px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent text-sm";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/lager/leverantorer" className="p-2 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-workshop-muted" />
              <h1 className="text-2xl font-bold text-workshop-text">{supplier.name}</h1>
            </div>
            {supplier.orgNr && (
              <p className="text-workshop-muted text-sm ml-9">Org.nr: {supplier.orgNr}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-text hover:bg-workshop-elevated transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Redigera
            </button>
          ) : (
            <button
              onClick={() => { setEditing(false); setForm(supplier); setError(""); }}
              className="flex items-center gap-2 px-3 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-muted hover:bg-workshop-elevated transition-colors"
            >
              <X className="h-4 w-4" />
              Avbryt
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-3 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-md text-sm transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Tar bort..." : "Ta bort"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">{error}</div>
      )}

      {/* Info cards or edit form */}
      {editing ? (
        <div className="space-y-4">
          {/* Company info */}
          <div className="surface p-5 space-y-4">
            <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Företagsuppgifter</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Företagsnamn *</label>
                <input type="text" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Org.nummer</label>
                <input type="text" value={form.orgNr ?? ""} onChange={(e) => setForm({ ...form, orgNr: e.target.value })}
                  className={inputClasses} />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="surface p-5 space-y-4">
            <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Kontakt</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Kontaktperson</label>
                <input type="text" value={form.contactName ?? ""} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Telefon</label>
                <input type="tel" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClasses} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-workshop-muted mb-1">E-post</label>
                <input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClasses} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="surface p-5 space-y-4">
            <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Adress</h3>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Gatuadress</label>
              <input type="text" value={form.addressLine1 ?? ""} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                className={inputClasses} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Postnummer</label>
                <input type="text" value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Ort</label>
                <input type="text" value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={inputClasses} />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="surface p-5 space-y-4">
            <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Inställningar</h3>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Standardledtid (dagar)</label>
              <input type="number" value={form.defaultLeadTimeDays ?? ""} min="0"
                onChange={(e) => setForm({ ...form, defaultLeadTimeDays: e.target.value ? parseInt(e.target.value) : null })}
                className={inputClasses + " max-w-[120px]"} />
            </div>
          </div>

          {/* Notes */}
          <div className="surface p-5 space-y-3">
            <label className="text-xs font-medium text-workshop-muted uppercase tracking-wider block">Anteckningar</label>
            <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} maxLength={1000} className={inputClasses + " resize-none"} />
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Spara ändringar
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Read-only view */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface p-4 space-y-3">
              <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Kontakt</h3>
              <div className="space-y-2">
                {supplier.contactName && (
                  <p className="text-sm text-workshop-text">{supplier.contactName}</p>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-workshop-muted shrink-0" />
                    <a href={`tel:${supplier.phone}`} className="text-workshop-text hover:text-workshop-accent">{supplier.phone}</a>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-workshop-muted shrink-0" />
                    <a href={`mailto:${supplier.email}`} className="text-workshop-text hover:text-workshop-accent">{supplier.email}</a>
                  </div>
                )}
                {!supplier.contactName && !supplier.phone && !supplier.email && (
                  <p className="text-sm text-workshop-muted">Ingen kontaktinfo</p>
                )}
              </div>
            </div>

            <div className="surface p-4 space-y-3">
              <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Adress</h3>
              {supplier.addressLine1 ? (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-workshop-muted shrink-0 mt-0.5" />
                  <div className="text-workshop-text">
                    <p>{supplier.addressLine1}</p>
                    <p>{supplier.postalCode} {supplier.city}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-workshop-muted">Ingen adress registrerad</p>
              )}

              {supplier.defaultLeadTimeDays && (
                <div className="pt-2 border-t border-workshop-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-workshop-muted">Standardledtid</span>
                    <span className="text-workshop-text">{supplier.defaultLeadTimeDays} dagar</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {supplier.notes && (
            <div className="surface p-4">
              <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-2">Anteckningar</h3>
              <p className="text-workshop-text text-sm whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </>
      )}

      {/* Parts from this supplier */}
      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">
            Artiklar från denna leverantör
          </h3>
          <span className="text-xs text-workshop-muted">{parts.length} st</span>
        </div>

        {parts.length > 0 ? (
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-workshop-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-workshop-muted">Artikelnr</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-workshop-muted">Benämning</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-workshop-muted hidden sm:table-cell">Inköp</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-workshop-muted hidden sm:table-cell">Försäljning</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-workshop-muted">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className="border-b border-workshop-border/50 hover:bg-workshop-elevated/50">
                    <td className="px-3 py-2 font-mono text-xs text-workshop-muted">{p.partNumber}</td>
                    <td className="px-3 py-2">
                      <Link href={`/lager/${p.id}`} className="text-workshop-text hover:text-workshop-accent">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-workshop-muted hidden sm:table-cell">
                      {parseFloat(p.costPrice).toLocaleString("sv-SE", { style: "currency", currency: "SEK" })}
                    </td>
                    <td className="px-3 py-2 text-right text-workshop-text hidden sm:table-cell">
                      {parseFloat(p.sellPrice).toLocaleString("sv-SE", { style: "currency", currency: "SEK" })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-workshop-text">{p.stockQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center">
            <Package className="h-8 w-8 text-workshop-muted mx-auto mb-2" />
            <p className="text-sm text-workshop-muted">Inga artiklar kopplade till denna leverantör</p>
          </div>
        )}
      </div>
    </div>
  );
}

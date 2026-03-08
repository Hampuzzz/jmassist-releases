"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Check } from "lucide-react";
import Link from "next/link";

export default function NyLeverantorPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Leverantörsnamn krävs.");
      return;
    }

    try {
      const res = await fetch("/api/leverantorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, orgNr, contactName, phone, email,
          addressLine1, postalCode, city,
          defaultLeadTimeDays: defaultLeadTimeDays || null,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Något gick fel.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        startTransition(() => {
          router.push("/lager/leverantorer");
          router.refresh();
        });
      }, 1000);
    } catch {
      setError("Nätverksfel — kontrollera anslutningen.");
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="surface p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-900/50 border-2 border-green-500 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-workshop-text mb-2">Leverantör skapad!</h2>
          <p className="text-workshop-muted">Du skickas tillbaka till leverantörslistan...</p>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/lager/leverantorer" className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors">
          <ArrowLeft className="h-5 w-5 text-workshop-text" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Ny leverantör</h1>
          <p className="text-workshop-muted text-sm">Registrera en ny leverantör i systemet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company info */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Företagsuppgifter</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Företagsnamn *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="BilXtra AB" className={inputClasses} autoFocus />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Org.nummer</label>
              <input type="text" value={orgNr} onChange={(e) => setOrgNr(e.target.value)}
                placeholder="5591234567" className={inputClasses} />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Kontakt</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Kontaktperson</label>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                placeholder="Anna Svensson" className={inputClasses} />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Telefon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="031-123 45 67" className={inputClasses} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-workshop-muted mb-1">E-post</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="order@leverantor.se" className={inputClasses} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Adress</h3>
          <div>
            <label className="block text-xs text-workshop-muted mb-1">Gatuadress</label>
            <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Industrivägen 5" className={inputClasses} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Postnummer</label>
              <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
                placeholder="443 41" className={inputClasses} />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Ort</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Gråbo" className={inputClasses} />
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Inställningar</h3>
          <div>
            <label className="block text-xs text-workshop-muted mb-1">Standardledtid (dagar)</label>
            <input type="number" value={defaultLeadTimeDays} onChange={(e) => setDefaultLeadTimeDays(e.target.value)}
              placeholder="3" min="0" className={inputClasses + " max-w-[120px]"} />
          </div>
        </div>

        {/* Notes */}
        <div className="surface p-5 space-y-3">
          <label className="text-sm font-medium text-workshop-muted uppercase tracking-wider block">Anteckningar</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000}
            placeholder="Valfria anteckningar om leverantören..."
            className={inputClasses + " resize-none"} />
        </div>

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">{error}</div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/lager/leverantorer" className="px-5 py-2.5 bg-workshop-surface border border-workshop-border rounded-lg text-workshop-text hover:bg-workshop-elevated transition-colors text-sm">
            Avbryt
          </Link>
          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Spara leverantör
          </button>
        </div>
      </form>
    </div>
  );
}

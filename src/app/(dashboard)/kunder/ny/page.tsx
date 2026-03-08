"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, User, Save, Loader2, Check } from "lucide-react";
import Link from "next/link";

export default function NyKundPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCompany, setIsCompany] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Individual fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [personalNr, setPersonalNr] = useState("");

  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [orgNr, setOrgNr] = useState("");

  // Shared fields
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const body: any = {
      isCompany,
      phone: phone || null,
      email: email || null,
      addressLine1: addressLine1 || null,
      postalCode: postalCode || null,
      city: city || null,
      notes: notes || null,
    };

    if (isCompany) {
      if (!companyName.trim() || !orgNr.trim()) {
        setError("Företagsnamn och organisationsnummer krävs.");
        return;
      }
      body.companyName = companyName.trim();
      body.orgNr = orgNr.trim();
    } else {
      if (!firstName.trim()) {
        setError("Förnamn krävs.");
        return;
      }
      body.firstName = firstName.trim();
      body.lastName = lastName.trim() || null;
      body.personalNr = personalNr || null;
    }

    try {
      const res = await fetch("/api/kunder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Något gick fel.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        startTransition(() => {
          router.push("/kunder");
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
          <h2 className="text-xl font-bold text-workshop-text mb-2">Kund skapad!</h2>
          <p className="text-workshop-muted">Du skickas tillbaka till kundlistan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/kunder" className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors">
          <ArrowLeft className="h-5 w-5 text-workshop-text" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Ny kund</h1>
          <p className="text-workshop-muted text-sm">Registrera en ny kund i systemet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type toggle */}
        <div className="surface p-5">
          <label className="text-sm font-medium text-workshop-muted uppercase tracking-wider block mb-3">Kundtyp</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsCompany(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${
                !isCompany
                  ? "border-workshop-accent bg-workshop-accent/10 text-workshop-accent"
                  : "border-workshop-border text-workshop-muted hover:border-workshop-muted"
              }`}
            >
              <User className="h-5 w-5" />
              Privatperson
            </button>
            <button
              type="button"
              onClick={() => setIsCompany(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${
                isCompany
                  ? "border-workshop-accent bg-workshop-accent/10 text-workshop-accent"
                  : "border-workshop-border text-workshop-muted hover:border-workshop-muted"
              }`}
            >
              <Building2 className="h-5 w-5" />
              Företag
            </button>
          </div>
        </div>

        {/* Name fields */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">
            {isCompany ? "Företagsuppgifter" : "Personuppgifter"}
          </h3>

          {isCompany ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Företagsnamn *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="AB Exempel"
                  className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Org.nummer *</label>
                <input
                  type="text"
                  value={orgNr}
                  onChange={(e) => setOrgNr(e.target.value)}
                  placeholder="5591234567"
                  className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Förnamn *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Anna"
                  className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-workshop-muted mb-1">Efternamn</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Svensson"
                  className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Kontakt</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Telefon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="070-123 45 67"
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent" />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">E-post</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@example.se"
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Adress</h3>
          <div>
            <label className="block text-xs text-workshop-muted mb-1">Gatuadress</label>
            <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Storgatan 1"
              className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Postnummer</label>
              <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="411 01"
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent" />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Ort</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Göteborg"
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="surface p-5 space-y-3">
          <label className="text-sm font-medium text-workshop-muted uppercase tracking-wider block">Anteckningar</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} placeholder="Valfria anteckningar..."
            className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent resize-none" />
        </div>

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">{error}</div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/kunder" className="px-5 py-2.5 bg-workshop-surface border border-workshop-border rounded-lg text-workshop-text hover:bg-workshop-elevated transition-colors text-sm">
            Avbryt
          </Link>
          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Spara kund
          </button>
        </div>
      </form>
    </div>
  );
}

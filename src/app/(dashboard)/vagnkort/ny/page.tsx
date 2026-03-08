"use client";

import { Suspense, useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Car, Save, Loader2, Check, Search, Sparkles, X, User, Building2, Plus } from "lucide-react";
import Link from "next/link";

type CustomerOption = {
  id: string; isCompany: boolean; firstName: string | null; lastName: string | null;
  companyName: string | null; phone: string | null; email: string | null; city: string | null;
};

function displayName(c: CustomerOption) {
  return c.isCompany ? c.companyName ?? "–" : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "–";
}

const FUEL_OPTIONS = [
  { value: "", label: "Välj bränsle" },
  { value: "petrol", label: "Bensin" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "El" },
  { value: "hybrid", label: "Hybrid" },
  { value: "plug_in_hybrid", label: "Laddhybrid" },
  { value: "ethanol", label: "Etanol" },
  { value: "lpg", label: "Gas" },
  { value: "other", label: "Övrigt" },
];

const TRANSMISSION_OPTIONS = [
  { value: "", label: "Välj" },
  { value: "manual", label: "Manuell" },
  { value: "automatic", label: "Automat" },
];

const DRIVE_OPTIONS = [
  { value: "", label: "Välj" },
  { value: "fwd", label: "Framhjulsdrift" },
  { value: "rwd", label: "Bakhjulsdrift" },
  { value: "awd", label: "Fyrhjulsdrift" },
];

// Maps Swedish API values → English form values
function mapFuel(v: string | null | undefined): string {
  if (!v) return "";
  const m: Record<string, string> = {
    bensin: "petrol", diesel: "diesel", el: "electric", electric: "electric",
    hybrid: "hybrid", laddhybrid: "plug_in_hybrid", plug_in_hybrid: "plug_in_hybrid",
    etanol: "ethanol", ethanol: "ethanol", gas: "lpg", lpg: "lpg",
    petrol: "petrol", other: "other", okänd: "other",
  };
  return m[v.toLowerCase()] ?? "";
}

function mapTransmission(v: string | null | undefined): string {
  if (!v) return "";
  const m: Record<string, string> = {
    manuell: "manual", manual: "manual",
    automat: "automatic", automatic: "automatic",
  };
  return m[v.toLowerCase()] ?? "";
}

function mapDrive(v: string | null | undefined): string {
  if (!v) return "";
  const m: Record<string, string> = {
    framhjulsdrift: "fwd", fwd: "fwd",
    bakhjulsdrift: "rwd", rwd: "rwd",
    fyrhjulsdrift: "awd", awd: "awd",
  };
  return m[v.toLowerCase()] ?? "";
}

function NyFordonPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");
  const [didAutoLookup, setDidAutoLookup] = useState(false);

  const [regNr, setRegNr] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [color, setColor] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [transmission, setTransmission] = useState("");
  const [driveType, setDriveType] = useState("");
  const [engineSizeCc, setEngineSizeCc] = useState("");
  const [powerKw, setPowerKw] = useState("");
  const [vin, setVin] = useState("");
  const [mileageKm, setMileageKm] = useState("");
  const [notes, setNotes] = useState("");

  // Customer linking
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Debounced customer search
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await fetch(`/api/kunder?search=${encodeURIComponent(customerSearch)}&limit=8`);
        if (res.ok) {
          const { data } = await res.json();
          setCustomerResults(data ?? []);
        }
      } catch { /* ignore */ }
      setSearchingCustomer(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerSearch]);

  async function handleLookup() {
    if (regNr.length < 2) return;
    setLookupLoading(true);
    setLookupMsg("Söker fordonsdata...");
    setError("");

    try {
      // Use the bridge endpoint which tries: local DB → Python scrapers → Bilvision/mock
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNr }),
      });
      const data = await res.json();

      // Handle CAPTCHA required from Python scraper
      if (data.captcha_required) {
        setLookupMsg("⚠ CAPTCHA krävs — lös den i scraper-fönstret och försök igen.");
        return;
      }

      if (data.found && data.vehicle) {
        const v = data.vehicle;
        setBrand(v.brand ?? "");
        setModel(v.model ?? "");
        setModelYear(v.modelYear?.toString() ?? v.year?.toString() ?? "");
        setColor(v.color ?? "");
        setVin(v.vin ?? "");
        setFuelType(mapFuel(v.fuelType));
        setTransmission(mapTransmission(v.transmission));
        setDriveType(mapDrive(v.driveType));
        if (v.engineSizeCc || v.engineSizeCC) setEngineSizeCc((v.engineSizeCc ?? v.engineSizeCC ?? "").toString());
        if (v.powerKw) setPowerKw(v.powerKw.toString());

        const sourceLabel = data.source === "local_db" ? "lokal databas"
          : data.source?.includes("scraper") || data.source?.includes("car.info") || data.source?.includes("biluppgifter") ? "biluppgifter"
          : "extern sökning";
        setLookupMsg(`✓ Data hämtad (${sourceLabel}) — ${v.brand} ${v.model} ${v.modelYear ?? ""}`);
      } else {
        setLookupMsg("Ingen data hittades — fyll i manuellt.");
      }
    } catch {
      setLookupMsg("Ingen data hittades — fyll i manuellt.");
    } finally {
      setLookupLoading(false);
    }
  }

  // Pre-fill regNr from URL param (?reg=ABC123) and auto-trigger lookup
  useEffect(() => {
    const prefill = searchParams.get("reg");
    if (prefill && !didAutoLookup) {
      const normalized = prefill.toUpperCase().replace(/[\s-]/g, "");
      setRegNr(normalized);
      setDidAutoLookup(true);
      // Auto-trigger lookup after a short delay so the state is set
      setTimeout(() => {
        (async () => {
          setLookupLoading(true);
          setLookupMsg("Söker fordonsdata...");
          try {
            const res = await fetch("/api/lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ regNr: normalized }),
            });
            const data = await res.json();
            if (data.captcha_required) {
              setLookupMsg("⚠ CAPTCHA krävs — lös den i scraper-fönstret och försök igen.");
              return;
            }
            if (data.found && data.vehicle) {
              const v = data.vehicle;
              setBrand(v.brand ?? "");
              setModel(v.model ?? "");
              setModelYear(v.modelYear?.toString() ?? v.year?.toString() ?? "");
              setColor(v.color ?? "");
              setVin(v.vin ?? "");
              setFuelType(mapFuel(v.fuelType));
              setTransmission(mapTransmission(v.transmission));
              setDriveType(mapDrive(v.driveType));
              if (v.engineSizeCc || v.engineSizeCC) setEngineSizeCc((v.engineSizeCc ?? v.engineSizeCC ?? "").toString());
              if (v.powerKw) setPowerKw(v.powerKw.toString());
              const sourceLabel = data.source === "local_db" ? "lokal databas"
                : data.source?.includes("scraper") || data.source?.includes("car.info") || data.source?.includes("biluppgifter") ? "biluppgifter"
                : "extern sökning";
              setLookupMsg(`✓ Data hämtad (${sourceLabel}) — ${v.brand} ${v.model} ${v.modelYear ?? ""}`);
            } else {
              setLookupMsg("Ingen data hittades — fyll i manuellt.");
            }
          } catch {
            setLookupMsg("Ingen data hittades — fyll i manuellt.");
          } finally {
            setLookupLoading(false);
          }
        })();
      }, 100);
    }
  }, [searchParams, didAutoLookup]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!regNr.trim() || !brand.trim() || !model.trim()) {
      setError("Regnummer, märke och modell krävs.");
      return;
    }

    const body: any = {
      regNr: regNr.trim(),
      brand: brand.trim(),
      model: model.trim(),
      modelYear: modelYear ? parseInt(modelYear) : null,
      color: color || null,
      fuelType: fuelType || null,
      transmission: transmission || null,
      driveType: driveType || null,
      engineSizeCc: engineSizeCc ? parseInt(engineSizeCc) : null,
      powerKw: powerKw ? parseInt(powerKw) : null,
      vin: vin || null,
      mileageKm: mileageKm ? parseInt(mileageKm) : null,
      notes: notes || null,
      customerId: selectedCustomer?.id ?? null,
    };

    try {
      const res = await fetch("/api/vagnkort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        try {
          const data = await res.json();
          setError(data.error ?? data.details?.fieldErrors?.regNr?.[0] ?? `Serverfel (${res.status})`);
        } catch {
          setError(`Serverfel (${res.status}) — försök igen.`);
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        startTransition(() => {
          router.push("/vagnkort");
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
          <h2 className="text-xl font-bold text-workshop-text mb-2">Fordon registrerat!</h2>
          <p className="text-workshop-muted">Du skickas tillbaka till fordonsregistret...</p>
        </div>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/vagnkort" className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors">
          <ArrowLeft className="h-5 w-5 text-workshop-text" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Registrera fordon</h1>
          <p className="text-workshop-muted text-sm">Lägg till ett nytt fordon i systemet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Reg number + lookup */}
        <div className="surface p-5 space-y-3">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Registreringsnummer</h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={regNr}
                onChange={(e) => setRegNr(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={10}
                className={`${inputCls} font-mono text-lg tracking-wider uppercase`}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupLoading || regNr.length < 2}
              className="flex items-center gap-2 px-5 py-2.5 bg-workshop-info hover:bg-workshop-info/80 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {lookupLoading ? "Hämtar..." : "Hämta data"}
            </button>
          </div>
          {lookupMsg && (
            <p className={`text-sm ${lookupMsg.startsWith("✓") ? "text-green-400" : "text-workshop-muted"}`}>
              {lookupMsg}
            </p>
          )}
        </div>

        {/* Customer picker */}
        <div className="surface p-5 space-y-3">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Ägare (valfritt)</h3>

          {selectedCustomer ? (
            <div className="flex items-center justify-between p-3 bg-workshop-elevated rounded-lg">
              <div className="flex items-center gap-2">
                {selectedCustomer.isCompany
                  ? <Building2 className="h-4 w-4 text-blue-400" />
                  : <User className="h-4 w-4 text-workshop-muted" />}
                <div>
                  <p className="text-sm font-medium text-workshop-text">{displayName(selectedCustomer)}</p>
                  <p className="text-xs text-workshop-muted">
                    {[selectedCustomer.phone, selectedCustomer.email].filter(Boolean).join(" • ")}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="text-workshop-muted hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : showCustomerPicker ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-workshop-muted" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Sök kund (namn, telefon, e-post)..."
                  autoFocus
                  className="w-full pl-9 pr-8 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-sm text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                />
                <button type="button" onClick={() => { setShowCustomerPicker(false); setCustomerSearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-workshop-muted hover:text-workshop-text">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {searchingCustomer && (
                <div className="flex items-center gap-2 text-sm text-workshop-muted py-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Söker...
                </div>
              )}

              {customerResults.length > 0 && (
                <div className="border border-workshop-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); setCustomerSearch(""); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-workshop-elevated transition-colors border-b border-workshop-border last:border-b-0"
                    >
                      {c.isCompany
                        ? <Building2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        : <User className="h-4 w-4 text-workshop-muted flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-workshop-text font-medium truncate">{displayName(c)}</p>
                        <p className="text-xs text-workshop-muted truncate">
                          {[c.phone, c.email, c.city].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {customerSearch.length >= 2 && customerResults.length === 0 && !searchingCustomer && (
                <p className="text-xs text-workshop-muted py-1">Ingen kund hittades</p>
              )}

              <Link href="/kunder/ny" className="flex items-center gap-1 text-xs text-workshop-accent hover:underline">
                <Plus className="h-3 w-3" /> Skapa ny kund
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomerPicker(true)}
              className="flex items-center gap-2 text-sm text-workshop-accent hover:underline"
            >
              <Search className="h-4 w-4" />
              Välj ägare
            </button>
          )}
        </div>

        {/* Vehicle info */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Fordonsuppgifter</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Märke *</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Volvo" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Modell *</label>
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="V70" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Årsmodell</label>
              <input type="number" value={modelYear} onChange={(e) => setModelYear(e.target.value)} placeholder="2020" min={1900} max={new Date().getFullYear() + 2} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Färg</label>
              <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Svart" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Technical */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Teknisk data</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Bränsle</label>
              <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className={inputCls}>
                {FUEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Växellåda</label>
              <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className={inputCls}>
                {TRANSMISSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Drivning</label>
              <select value={driveType} onChange={(e) => setDriveType(e.target.value)} className={inputCls}>
                {DRIVE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Motor (cc)</label>
              <input type="number" value={engineSizeCc} onChange={(e) => setEngineSizeCc(e.target.value)} placeholder="1969" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Effekt (kW)</label>
              <input type="number" value={powerKw} onChange={(e) => setPowerKw(e.target.value)} placeholder="140" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Miltal (km)</label>
              <input type="number" value={mileageKm} onChange={(e) => setMileageKm(e.target.value)} placeholder="85000" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-workshop-muted mb-1">VIN (chassinummer)</label>
            <input type="text" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} maxLength={17} placeholder="YV1SW61P042XXXXXX" className={`${inputCls} font-mono tracking-wider`} />
          </div>
        </div>

        {/* Notes */}
        <div className="surface p-5 space-y-3">
          <label className="text-sm font-medium text-workshop-muted uppercase tracking-wider block">Anteckningar</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} placeholder="Valfria anteckningar..."
            className={`${inputCls} resize-none`} />
        </div>

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">{error}</div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/vagnkort" className="px-5 py-2.5 bg-workshop-surface border border-workshop-border rounded-lg text-workshop-text hover:bg-workshop-elevated transition-colors text-sm">
            Avbryt
          </Link>
          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
            Registrera fordon
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NyFordonPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-workshop-muted">Laddar...</div>}>
      <NyFordonPageContent />
    </Suspense>
  );
}

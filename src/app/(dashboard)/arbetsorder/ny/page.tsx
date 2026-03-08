"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Car, Search, User, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface VehicleResult {
  id: string;
  regNr: string;
  brand: string;
  model: string;
  modelYear: number | null;
  customerId: string | null;
  customer?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

export default function NyArbetsorderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [regNr, setRegNr] = useState("");
  const [searching, setSearching] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  // New vehicle fields
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");

  // Customer
  const [customerId, setCustomerId] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  // Order details
  const [complaint, setComplaint] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [mileageIn, setMileageIn] = useState("");
  const [promisedAt, setPromisedAt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchVehicle() {
    if (!regNr.trim()) return;
    setSearching(true);
    setNotFound(false);
    setError(null);

    try {
      const normalized = regNr.toUpperCase().replace(/[\s-]/g, "");
      const res = await fetch(`/api/vagnkort/sok?reg_nr=${normalized}`);
      const data = await res.json();

      if (res.ok && data.data) {
        setVehicle(data.data);
        if (data.data.customer) {
          setCustomerId(data.data.customer.id);
          setCustomerFirstName(data.data.customer.firstName ?? "");
          setCustomerLastName(data.data.customer.lastName ?? "");
          setCustomerPhone(data.data.customer.phone ?? "");
          setCustomerEmail(data.data.customer.email ?? "");
          setIsNewCustomer(false);
        } else {
          setIsNewCustomer(true);
        }
        setStep(2);
      } else {
        setNotFound(true);
      }
    } catch {
      setError("Kunde inte söka fordon");
    } finally {
      setSearching(false);
    }
  }

  async function createVehicleAndContinue() {
    if (!newBrand.trim() || !newModel.trim()) return;
    setSearching(true);
    setError(null);

    try {
      const normalized = regNr.toUpperCase().replace(/[\s-]/g, "");
      const res = await fetch("/api/vagnkort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regNr: normalized,
          brand: newBrand,
          model: newModel,
          modelYear: newYear ? parseInt(newYear) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setVehicle(data.data);
        setIsNewCustomer(true);
        setStep(2);
      } else {
        setError(data.error ?? "Kunde inte skapa fordon");
      }
    } catch {
      setError("Fel vid skapande av fordon");
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit() {
    if (!vehicle) return;
    setSubmitting(true);
    setError(null);

    try {
      let finalCustomerId = customerId;

      // Create customer if new
      if (isNewCustomer || !finalCustomerId) {
        const custRes = await fetch("/api/kunder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isCompany: false,
            firstName: customerFirstName,
            lastName: customerLastName,
            phone: customerPhone,
            email: customerEmail || undefined,
          }),
        });
        const custData = await custRes.json();
        if (!custRes.ok) {
          setError(custData.error ?? "Kunde inte skapa kund");
          setSubmitting(false);
          return;
        }
        finalCustomerId = custData.data.id;

        // Link vehicle to customer
        await fetch(`/api/vagnkort`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: vehicle.id, customerId: finalCustomerId }),
        });
      }

      // Create work order
      const orderRes = await fetch("/api/arbetsorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          customerId: finalCustomerId,
          customerComplaint: complaint || undefined,
          internalNotes: internalNotes || undefined,
          mileageIn: mileageIn ? parseInt(mileageIn) : undefined,
          promisedAt: promisedAt ? new Date(promisedAt).toISOString() : undefined,
        }),
      });
      const orderData = await orderRes.json();
      if (orderRes.ok) {
        router.push(`/arbetsorder/${orderData.data.id}`);
      } else {
        setError(orderData.error ?? "Kunde inte skapa arbetsorder");
      }
    } catch {
      setError("Oväntat fel");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/arbetsorder"
          className="p-2 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Ny Arbetsorder</h1>
          <p className="text-workshop-muted text-sm">Steg {step} av 3</p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              s <= step ? "bg-workshop-accent" : "bg-workshop-border"
            )}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 px-4 py-3 rounded-md text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* STEP 1: Vehicle lookup */}
      {step === 1 && (
        <div className="surface p-6 space-y-4">
          <div className="flex items-center gap-2 text-workshop-accent mb-2">
            <Car className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Fordon</h2>
          </div>

          <div>
            <label className="text-sm font-medium text-workshop-text mb-1 block">
              Registreringsnummer
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={regNr}
                onChange={(e) => setRegNr(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && searchVehicle()}
                placeholder="ABC 123"
                className="flex-1 px-4 py-3 bg-workshop-elevated border border-workshop-border rounded-md
                           text-workshop-text font-mono text-lg uppercase tracking-widest
                           placeholder-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                autoFocus
              />
              <button
                onClick={searchVehicle}
                disabled={searching || !regNr.trim()}
                className="px-6 py-3 bg-workshop-accent hover:bg-workshop-accent/80 text-white
                           rounded-md font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {searching ? "Söker..." : "Sök"}
              </button>
            </div>
          </div>

          {/* Vehicle found */}
          {vehicle && (
            <div className="bg-green-950/30 border border-green-900/50 rounded-md p-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="reg-plate text-sm">{vehicle.regNr}</span>
                <span className="text-workshop-text font-medium">
                  {vehicle.brand} {vehicle.model}
                  {vehicle.modelYear ? ` (${vehicle.modelYear})` : ""}
                </span>
              </div>
            </div>
          )}

          {/* Vehicle NOT found — create new */}
          {notFound && (
            <div className="space-y-4 bg-amber-950/20 border border-amber-900/50 rounded-md p-4">
              <p className="text-amber-300 text-sm font-medium">
                Fordon hittades inte — skapa nytt:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-workshop-muted">Märke *</label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Volvo"
                    className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-workshop-muted">Modell *</label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="V70"
                    className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-workshop-muted">Årsmodell</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    placeholder="2020"
                    className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                  />
                </div>
              </div>
              <button
                onClick={createVehicleAndContinue}
                disabled={!newBrand.trim() || !newModel.trim() || searching}
                className="px-4 py-3 bg-workshop-accent hover:bg-workshop-accent/80 text-white rounded-md font-medium disabled:opacity-50"
              >
                {searching ? "Skapar..." : "Skapa fordon & fortsätt"}
              </button>
            </div>
          )}

          {vehicle && (
            <button
              onClick={() => setStep(2)}
              className="w-full py-3 bg-workshop-accent hover:bg-workshop-accent/80 text-white rounded-md font-medium flex items-center justify-center gap-2"
            >
              Fortsätt
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* STEP 2: Customer */}
      {step === 2 && (
        <div className="surface p-6 space-y-4">
          <div className="flex items-center gap-2 text-workshop-accent mb-2">
            <User className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Kund</h2>
          </div>

          {!isNewCustomer && customerId && (
            <div className="bg-green-950/30 border border-green-900/50 rounded-md p-3">
              <p className="text-green-300 text-sm">
                Befintlig kund: {customerFirstName} {customerLastName}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-workshop-muted">Förnamn *</label>
              <input
                type="text"
                value={customerFirstName}
                onChange={(e) => setCustomerFirstName(e.target.value)}
                className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
            <div>
              <label className="text-xs text-workshop-muted">Efternamn *</label>
              <input
                type="text"
                value={customerLastName}
                onChange={(e) => setCustomerLastName(e.target.value)}
                className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-workshop-muted">Telefon *</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="07X-XXX XX XX"
                className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
            <div>
              <label className="text-xs text-workshop-muted">E-post</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-3 bg-workshop-elevated border border-workshop-border text-workshop-text rounded-md"
            >
              Tillbaka
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!customerFirstName.trim() || !customerLastName.trim() || !customerPhone.trim()}
              className="flex-1 py-3 bg-workshop-accent hover:bg-workshop-accent/80 text-white rounded-md font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Fortsätt
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Order details */}
      {step === 3 && (
        <div className="surface p-6 space-y-4">
          <div className="flex items-center gap-2 text-workshop-accent mb-2">
            <Wrench className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Orderdetaljer</h2>
          </div>

          {/* Summary banner */}
          <div className="bg-workshop-elevated rounded-md p-3 flex items-center gap-3">
            <span className="reg-plate text-xs py-0 px-1.5">{vehicle?.regNr}</span>
            <span className="text-sm text-workshop-text">
              {vehicle?.brand} {vehicle?.model}
            </span>
            <span className="text-sm text-workshop-muted ml-auto">
              {customerFirstName} {customerLastName}
            </span>
          </div>

          <div>
            <label className="text-xs text-workshop-muted">Kundens felbeskrivning</label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={3}
              placeholder="Beskriv vad kunden upplever..."
              className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-workshop-muted">Interna anteckningar</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              placeholder="Synligt bara för verkstaden..."
              className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-workshop-muted">Mätarställning (km)</label>
              <input
                type="number"
                value={mileageIn}
                onChange={(e) => setMileageIn(e.target.value)}
                placeholder="123456"
                className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
            <div>
              <label className="text-xs text-workshop-muted">Utlovat datum</label>
              <input
                type="date"
                value={promisedAt}
                onChange={(e) => setPromisedAt(e.target.value)}
                className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-3 bg-workshop-elevated border border-workshop-border text-workshop-text rounded-md"
            >
              Tillbaka
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-workshop-accent hover:bg-workshop-accent/80 text-white rounded-md font-semibold disabled:opacity-50"
            >
              {submitting ? "Skapar order..." : "Skapa Arbetsorder"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

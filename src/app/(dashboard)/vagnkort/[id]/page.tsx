"use client";

import { useState } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Car, Loader2, Wrench, User, Building2,
  Search, X, Plus, ChevronRight,
} from "lucide-react";
import DeleteButton from "@/components/DeleteButton";
import { EnrichButton } from "@/components/vagnkort/EnrichButton";

const FUEL_LABELS: Record<string, string> = {
  petrol: "Bensin", diesel: "Diesel", electric: "El", hybrid: "Hybrid",
  plug_in_hybrid: "Laddhybrid", ethanol: "Etanol", lpg: "Gas", hydrogen: "Vätgas", other: "Övrigt",
};
const TRANS_LABELS: Record<string, string> = { manual: "Manuell", automatic: "Automat" };
const DRIVE_LABELS: Record<string, string> = { fwd: "Framhjulsdrift", rwd: "Bakhjulsdrift", awd: "Fyrhjulsdrift" };

type Vehicle = {
  id: string; regNr: string; brand: string; model: string; modelYear: number | null;
  color: string | null; fuelType: string | null; transmission: string | null;
  driveType: string | null; engineSizeCc: number | null; powerKw: number | null;
  engineCode: string | null; vin: string | null; mileageKm: number | null; notes: string | null;
  customerId: string | null; createdAt: string; updatedAt: string;
};

type Customer = {
  id: string; isCompany: boolean; firstName: string | null; lastName: string | null;
  companyName: string | null; phone: string | null; email: string | null;
  city: string | null; orgNr: string | null;
};

type WorkOrder = {
  id: string; orderNumber: string; status: string; receivedAt: string;
};

function customerName(c: Customer) {
  return c.isCompany ? c.companyName ?? "–" : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "–";
}

export default function VehicleDetailPage() {
  const params = useParams();
  const id = params.id as string;

  // SWR hooks — cached, deduped, auto-revalidated
  const { data: vehicleData, error: vehicleError, mutate: mutateVehicle } = useSWR<{ data: Vehicle }>(
    `/api/vagnkort/${id}`
  );
  const vehicle = vehicleData?.data ?? null;

  const { data: customerData, mutate: mutateCustomer } = useSWR<{ data: Customer }>(
    vehicle?.customerId ? `/api/kunder/${vehicle.customerId}` : null
  );
  const customer = customerData?.data ?? null;

  const { data: woData } = useSWR<{ data: WorkOrder[] }>(
    vehicle ? `/api/arbetsorder?vehicle_id=${id}` : null
  );
  const workOrders = woData?.data ?? [];

  const loading = !vehicleData && !vehicleError;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Customer search
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  // SWR for customer search with debounce built into the key
  const { data: searchData } = useSWR<{ data: Customer[] }>(
    customerSearch.length >= 2 ? `/api/kunder?search=${encodeURIComponent(customerSearch)}&limit=10` : null,
    { dedupingInterval: 300 }
  );
  const customerResults = searchData?.data ?? [];

  async function linkCustomer(customerId: string | null) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/vagnkort/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Kunde inte uppdatera kopplingen");
        return;
      }
      const { data: updated } = await res.json();

      // Update SWR caches
      mutateVehicle({ data: updated }, false);
      if (customerId) {
        mutateCustomer();
      } else {
        mutateCustomer(undefined, false);
      }

      setShowCustomerSearch(false);
      setCustomerSearch("");
      setSuccess("Kundkoppling uppdaterad!");
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("Nätverksfel");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-workshop-accent" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Car className="h-12 w-12 text-workshop-muted mx-auto mb-4" />
        <h2 className="text-xl font-bold text-workshop-text mb-2">Fordonet hittades inte</h2>
        <Link href="/vagnkort" className="text-workshop-accent hover:underline text-sm">
          ← Tillbaka till fordonsregistret
        </Link>
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    received: "bg-blue-900/50 text-blue-300",
    in_progress: "bg-amber-900/50 text-amber-300",
    done: "bg-green-900/50 text-green-300",
    invoiced: "bg-purple-900/50 text-purple-300",
    delivered: "bg-zinc-700 text-zinc-300",
  };
  const STATUS_LABELS: Record<string, string> = {
    received: "Mottagen", in_progress: "Pågående", done: "Klar",
    invoiced: "Fakturerad", delivered: "Utlämnad",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/vagnkort" className="p-2 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <span className="reg-plate text-lg">{vehicle.regNr}</span>
              <h1 className="text-2xl font-bold text-workshop-text">
                {vehicle.brand} {vehicle.model}
              </h1>
            </div>
            <p className="text-workshop-muted text-sm">
              {vehicle.modelYear ? `Årsmodell ${vehicle.modelYear}` : ""}
              {vehicle.color ? ` • ${vehicle.color}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EnrichButton
            vehicleId={vehicle.id}
            regNr={vehicle.regNr}
            showLabel
            onEnriched={() => mutateVehicle()}
          />
          <DeleteButton
            id={vehicle.id}
            endpoint="/api/vagnkort"
            confirmMessage="Är du säker på att du vill ta bort detta fordon?"
          />
        </div>
      </div>

      {success && (
        <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-200 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Owner (Customer) */}
        <div className="surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Ägare</h3>
            {customer && !showCustomerSearch && (
              <button
                onClick={() => setShowCustomerSearch(true)}
                className="text-xs text-workshop-accent hover:underline"
              >
                Ändra
              </button>
            )}
          </div>

          {customer && !showCustomerSearch ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {customer.isCompany
                  ? <Building2 className="h-4 w-4 text-blue-400" />
                  : <User className="h-4 w-4 text-workshop-muted" />}
                <Link href={`/kunder/${customer.id}`} className="font-medium text-workshop-text hover:text-workshop-accent">
                  {customerName(customer)}
                </Link>
              </div>
              {customer.phone && (
                <p className="text-sm text-workshop-muted">
                  <a href={`tel:${customer.phone}`} className="hover:text-workshop-accent">{customer.phone}</a>
                </p>
              )}
              {customer.email && (
                <p className="text-sm text-workshop-muted">{customer.email}</p>
              )}
              <button
                onClick={() => linkCustomer(null)}
                disabled={saving}
                className="text-xs text-red-400 hover:text-red-300 mt-1"
              >
                Ta bort koppling
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {!showCustomerSearch ? (
                <button
                  onClick={() => setShowCustomerSearch(true)}
                  className="flex items-center gap-2 text-sm text-workshop-accent hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Koppla till kund
                </button>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-workshop-muted" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Sök kund..."
                      autoFocus
                      className="w-full pl-9 pr-8 py-2 bg-workshop-elevated border border-workshop-border rounded-lg text-sm text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                    />
                    <button
                      onClick={() => { setShowCustomerSearch(false); setCustomerSearch(""); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-workshop-muted hover:text-workshop-text"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {customerSearch.length >= 2 && !searchData && (
                    <div className="flex items-center gap-2 text-sm text-workshop-muted py-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Söker...
                    </div>
                  )}

                  {customerResults.length > 0 && (
                    <div className="border border-workshop-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => linkCustomer(c.id)}
                          disabled={saving}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-workshop-elevated transition-colors border-b border-workshop-border last:border-b-0"
                        >
                          {c.isCompany
                            ? <Building2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
                            : <User className="h-4 w-4 text-workshop-muted flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-workshop-text font-medium truncate">{customerName(c)}</p>
                            <p className="text-xs text-workshop-muted truncate">
                              {[c.phone, c.email, c.city].filter(Boolean).join(" • ")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {customerSearch.length >= 2 && customerResults.length === 0 && searchData && (
                    <p className="text-xs text-workshop-muted py-2">Ingen kund hittades</p>
                  )}

                  <Link
                    href="/kunder/ny"
                    className="flex items-center gap-1 text-xs text-workshop-accent hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Skapa ny kund
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {/* Technical data */}
        <div className="surface p-4 space-y-2">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Teknisk data</h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <div>
              <p className="text-workshop-muted text-xs">Bränsle</p>
              <p className="text-workshop-text">{FUEL_LABELS[vehicle.fuelType ?? ""] ?? "–"}</p>
            </div>
            <div>
              <p className="text-workshop-muted text-xs">Växellåda</p>
              <p className="text-workshop-text">{TRANS_LABELS[vehicle.transmission ?? ""] ?? "–"}</p>
            </div>
            <div>
              <p className="text-workshop-muted text-xs">Drivning</p>
              <p className="text-workshop-text">{DRIVE_LABELS[vehicle.driveType ?? ""] ?? "–"}</p>
            </div>
            <div>
              <p className="text-workshop-muted text-xs">Motor</p>
              <p className="text-workshop-text">
                {vehicle.engineSizeCc ? `${vehicle.engineSizeCc} cc` : "–"}
                {vehicle.powerKw ? ` / ${vehicle.powerKw} kW` : ""}
              </p>
            </div>
            <div>
              <p className="text-workshop-muted text-xs">Motorkod</p>
              <p className="text-workshop-text font-mono text-sm">{vehicle.engineCode ?? "–"}</p>
            </div>
            <div>
              <p className="text-workshop-muted text-xs">Miltal</p>
              <p className="text-workshop-text">
                {vehicle.mileageKm ? `${vehicle.mileageKm.toLocaleString("sv-SE")} km` : "–"}
              </p>
            </div>
            <div>
              <p className="text-workshop-muted text-xs">VIN</p>
              <p className="text-workshop-text font-mono text-xs">
                {vehicle.vin ?? "–"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {vehicle.notes && (
        <div className="surface p-4">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-2">Anteckningar</h3>
          <p className="text-workshop-text text-sm whitespace-pre-wrap">{vehicle.notes}</p>
        </div>
      )}

      {/* Work orders for this vehicle */}
      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Arbetsorder</h3>
          <span className="text-xs text-workshop-muted">{workOrders.length} st</span>
        </div>

        {workOrders.length > 0 ? (
          <div className="space-y-1">
            {workOrders.map((wo) => (
              <Link
                key={wo.id}
                href={`/arbetsorder/${wo.id}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-workshop-elevated transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Wrench className="h-4 w-4 text-workshop-muted" />
                  <span className="text-sm text-workshop-text font-medium">{wo.orderNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[wo.status] ?? "bg-zinc-700 text-zinc-300"}`}>
                    {STATUS_LABELS[wo.status] ?? wo.status}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-workshop-muted group-hover:text-workshop-text" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-workshop-muted py-2">Inga arbetsorder för detta fordon</p>
        )}
      </div>
    </div>
  );
}

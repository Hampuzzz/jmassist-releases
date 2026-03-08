"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search, Calendar, Check, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface Resource {
  id: string;
  name: string;
  resourceType: string;
}

interface Vehicle {
  id: string;
  regNr: string;
  brand: string | null;
  model: string | null;
  year?: string | null;
  modelYear?: string | null;
}

interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phone: string | null;
  email: string | null;
}

interface Props {
  resources: Resource[];
  vehicles?: Vehicle[];
  customers?: Customer[];
  preselectedDate?: string;
}

/** Debounced API search hook */
function useApiSearch<T>(endpoint: string, paramName: string, minChars = 1) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query.length < minChars) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Debounce 250ms
    timerRef.current = setTimeout(async () => {
      // Abort previous request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `${endpoint}?${paramName}=${encodeURIComponent(query)}&limit=10`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        setResults(json.data ?? []);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, endpoint, paramName, minChars]);

  return { query, setQuery, results, loading };
}

export default function NewBookingForm({ resources, preselectedDate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // API-based search for vehicles and customers
  const vehicleSearch = useApiSearch<Vehicle>("/api/vagnkort", "search", 2);
  const customerSearch = useApiSearch<Customer>("/api/kunder", "search", 2);

  // Form state
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "");
  const [date, setDate] = useState(preselectedDate ?? format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [serviceDescription, setServiceDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState("confirmed");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicle || !selectedCustomer) {
      setError("Du måste välja fordon och kund.");
      return;
    }

    setError("");
    const scheduledStart = new Date(`${date}T${startTime}:00`).toISOString();
    const scheduledEnd = new Date(`${date}T${endTime}:00`).toISOString();

    try {
      const res = await fetch("/api/kalender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: selectedVehicle.id,
          customerId: selectedCustomer.id,
          resourceId: resourceId || undefined,
          scheduledStart,
          scheduledEnd,
          serviceDescription: serviceDescription || undefined,
          internalNotes: internalNotes || undefined,
          status,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setError(data.error ?? "Resurskollision — tiden är redan bokad.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Något gick fel.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        startTransition(() => {
          router.push(`/kalender?week=0`);
          router.refresh();
        });
      }, 1000);
    } catch (err) {
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
          <h2 className="text-xl font-bold text-workshop-text mb-2">Bokning skapad!</h2>
          <p className="text-workshop-muted">Du skickas tillbaka till kalendern...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/kalender" className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors">
          <ArrowLeft className="h-5 w-5 text-workshop-text" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Ny bokning</h1>
          <p className="text-workshop-muted text-sm">Skapa en ny tidsbokning i kalendern</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vehicle selection */}
        <div className="surface p-5 space-y-3">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Fordon</h3>
          {selectedVehicle ? (
            <div className="flex items-center justify-between bg-workshop-elevated p-3 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="reg-plate text-xs py-0 px-1.5">{selectedVehicle.regNr}</span>
                <span className="text-sm text-workshop-text">
                  {selectedVehicle.brand} {selectedVehicle.model} {selectedVehicle.year ?? selectedVehicle.modelYear}
                </span>
              </div>
              <button type="button" onClick={() => { setSelectedVehicle(null); vehicleSearch.setQuery(""); }} className="text-xs text-workshop-accent hover:underline">
                Ändra
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-workshop-muted" />
              <input
                type="text"
                value={vehicleSearch.query}
                onChange={(e) => vehicleSearch.setQuery(e.target.value)}
                placeholder="Sök reg.nr, märke eller modell..."
                className="w-full pl-10 pr-4 py-3 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                autoFocus
              />
              {vehicleSearch.loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-workshop-muted animate-spin" />
              )}
              {vehicleSearch.results.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-workshop-elevated border border-workshop-border rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {vehicleSearch.results.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { setSelectedVehicle(v); vehicleSearch.setQuery(""); }}
                      className="w-full text-left px-4 py-3 hover:bg-workshop-surface transition-colors flex items-center gap-3"
                    >
                      <span className="reg-plate text-[10px] py-0 px-1">{v.regNr}</span>
                      <span className="text-sm text-workshop-text">{v.brand} {v.model}</span>
                      <span className="text-xs text-workshop-muted ml-auto">{v.year ?? v.modelYear}</span>
                    </button>
                  ))}
                </div>
              )}
              {!vehicleSearch.loading && vehicleSearch.query.length >= 2 && vehicleSearch.results.length === 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-workshop-elevated border border-workshop-border rounded-lg shadow-xl px-4 py-3">
                  <span className="text-sm text-workshop-muted">Inga fordon hittades</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer selection */}
        <div className="surface p-5 space-y-3">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Kund</h3>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-workshop-elevated p-3 rounded-lg">
              <div>
                <span className="text-sm text-workshop-text font-medium">
                  {selectedCustomer.companyName ?? `${selectedCustomer.firstName ?? ""} ${selectedCustomer.lastName ?? ""}`.trim()}
                </span>
                {selectedCustomer.phone && (
                  <span className="text-xs text-workshop-muted ml-2">{selectedCustomer.phone}</span>
                )}
              </div>
              <button type="button" onClick={() => { setSelectedCustomer(null); customerSearch.setQuery(""); }} className="text-xs text-workshop-accent hover:underline">
                Ändra
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-workshop-muted" />
              <input
                type="text"
                value={customerSearch.query}
                onChange={(e) => customerSearch.setQuery(e.target.value)}
                placeholder="Sök namn, företag eller telefon..."
                className="w-full pl-10 pr-4 py-3 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
              {customerSearch.loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-workshop-muted animate-spin" />
              )}
              {customerSearch.results.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-workshop-elevated border border-workshop-border rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {customerSearch.results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCustomer(c); customerSearch.setQuery(""); }}
                      className="w-full text-left px-4 py-3 hover:bg-workshop-surface transition-colors"
                    >
                      <span className="text-sm text-workshop-text font-medium">
                        {c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}
                      </span>
                      {c.phone && <span className="text-xs text-workshop-muted ml-3">{c.phone}</span>}
                      {c.email && <span className="text-xs text-workshop-muted ml-2 opacity-60">{c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
              {!customerSearch.loading && customerSearch.query.length >= 2 && customerSearch.results.length === 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-workshop-elevated border border-workshop-border rounded-lg shadow-xl px-4 py-3">
                  <span className="text-sm text-workshop-muted">Inga kunder hittades</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Time & resource */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Tid & Resurs</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Datum</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Starttid</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  const [h, m] = e.target.value.split(":").map(Number);
                  setEndTime(`${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
                }}
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Sluttid</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Resurs</label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              >
                <option value="">Ingen resurs</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.resourceType})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-workshop-muted mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text focus:outline-none focus:ring-2 focus:ring-workshop-accent"
              >
                <option value="confirmed">Bekräftad</option>
                <option value="pending">Väntande</option>
              </select>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Detaljer</h3>

          <div>
            <label className="block text-xs text-workshop-muted mb-1">Servicebeskrivning</label>
            <textarea
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder="T.ex. Service 6000 mil, Bromsbyte, Felsökning..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-workshop-muted mb-1">Interna anteckningar</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Synligt bara internt..."
              rows={2}
              maxLength={1000}
              className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none focus:ring-2 focus:ring-workshop-accent resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/kalender" className="px-5 py-2.5 bg-workshop-surface border border-workshop-border rounded-lg text-workshop-text hover:bg-workshop-elevated transition-colors text-sm">
            Avbryt
          </Link>
          <button
            type="submit"
            disabled={isPending || !selectedVehicle || !selectedCustomer}
            className="flex items-center gap-2 px-6 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Skapa bokning
          </button>
        </div>
      </form>
    </div>
  );
}

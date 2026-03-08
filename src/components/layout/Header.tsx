"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut, Bell, Search, X, Loader2, Car, User, Users,
  Wrench, ExternalLink, Plus, AlertTriangle, Clock, FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { getCachedVehicle, setCachedVehicle } from "@/lib/cache/vehicle-cache";

// ─── Status labels ───
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  queued:            { label: "I kö",              color: "bg-zinc-700 text-zinc-200" },
  diagnosing:        { label: "Diagnostik",        color: "bg-purple-700 text-purple-100" },
  ongoing:           { label: "Pågående",          color: "bg-amber-600 text-amber-100" },
  ordering_parts:    { label: "Beställer delar",   color: "bg-cyan-700 text-cyan-100" },
  waiting_for_parts: { label: "Väntar på delar",   color: "bg-blue-700 text-blue-100" },
  ready_for_pickup:  { label: "Klar för hämtning", color: "bg-green-600 text-green-100" },
  completed:         { label: "Klar",              color: "bg-green-800 text-green-200" },
  cancelled:         { label: "Avbruten",          color: "bg-red-800 text-red-200" },
};

export function Header() {
  const router = useRouter();
  const supabase = createClient();
  const [showSearch, setShowSearch] = useState(false);

  // Global Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-workshop-border bg-workshop-surface flex-shrink-0">
      <div className="flex items-center gap-3">
        <HeaderClock />
      </div>

      <div className="flex items-center gap-2">
        {/* Universal Search Button */}
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-workshop-elevated border border-workshop-border text-workshop-muted hover:text-workshop-text hover:border-workshop-accent/50 transition-colors min-h-[44px]"
        >
          <Search className="h-4 w-4" />
          <span className="hidden md:block text-sm">Sök kund, fordon, order...</span>
          <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-workshop-bg border border-workshop-border text-[10px] text-workshop-muted font-mono">
            Ctrl+K
          </kbd>
        </button>

        <button
          className="p-2 rounded-md text-workshop-muted hover:text-workshop-text hover:bg-workshop-elevated transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Notiser"
        >
          <Bell className="h-5 w-5" />
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-workshop-muted hover:text-workshop-text hover:bg-workshop-elevated transition-colors min-h-[44px]"
          aria-label="Logga ut"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:block text-sm">Logga ut</span>
        </button>
      </div>

      {/* Universal Search Modal */}
      {showSearch && <UniversalSearchModal onClose={() => setShowSearch(false)} />}
    </header>
  );
}

// ─── Clock (client-only to avoid hydration mismatch) ───
function HeaderClock() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return <div className="text-workshop-muted hidden md:block w-48" />;

  const timeStr = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="text-workshop-muted hidden md:block">
      <span className="font-mono font-semibold text-workshop-text">{timeStr}</span>
      <span className="text-xs ml-2 capitalize">{dateStr}</span>
    </div>
  );
}

// ─── Types ───
interface SearchResult {
  id: string;
  type: "customer" | "vehicle" | "work_order";
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
  badgeColor?: string;
}

interface LookupResult {
  found: boolean;
  exists_in_db: boolean;
  vehicle: any;
  customer: any;
  service_history: any[];
  source: string | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  customer: Users,
  vehicle: Car,
  work_order: Wrench,
};

// ─── Universal Search Modal ───
function UniversalSearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Vehicle deep lookup state
  const [lookupMode, setLookupMode] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard handling
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lookupMode) {
          setLookupMode(false);
          setLookupResult(null);
          setLookupError("");
        } else {
          onClose();
        }
        return;
      }

      if (lookupMode) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, searchResults.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        // Last item = deep lookup
        if (selectedIdx === searchResults.length && query.length >= 2) {
          doDeepLookup();
        } else if (searchResults[selectedIdx]) {
          router.push(searchResults[selectedIdx].href);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, searchResults, selectedIdx, query, lookupMode, router]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      setSelectedIdx(0);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setSelectedIdx(0);
        }
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Deep vehicle lookup (external sources)
  const doDeepLookup = useCallback(async () => {
    const regNr = query.toUpperCase().replace(/[\s-]/g, "");
    if (regNr.length < 2) return;

    setLookupMode(true);
    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);

    // Check LocalStorage cache first
    const cached = getCachedVehicle<LookupResult>(regNr);
    if (cached) {
      cached.source = "lokal cache";
      setLookupResult(cached);
      setLookupLoading(false);
      // Background refresh
      fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNr }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data?.found) setCachedVehicle(regNr, data); })
        .catch(() => {});
      return;
    }

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNr }),
      });
      if (!res.ok) {
        setLookupError("Sökning misslyckades.");
        return;
      }
      const data: LookupResult = await res.json();
      setLookupResult(data);
      if (data.found) setCachedVehicle(regNr, data);
      if (!data.found) setLookupError("Inget fordon hittades. Du kan registrera det manuellt.");
    } catch {
      setLookupError("Nätverksfel — kontrollera anslutningen.");
    } finally {
      setLookupLoading(false);
    }
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-workshop-surface border border-workshop-border rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center border-b border-workshop-border p-4 gap-3">
          <Search className="h-5 w-5 text-workshop-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (lookupMode) {
                setLookupMode(false);
                setLookupResult(null);
                setLookupError("");
              }
            }}
            placeholder="Sök kund, regnummer, telefon, arbetsorder..."
            className="flex-1 bg-transparent text-lg text-workshop-text placeholder:text-workshop-muted focus:outline-none"
          />
          {(searching || lookupLoading) && (
            <Loader2 className="h-5 w-5 text-workshop-accent animate-spin flex-shrink-0" />
          )}
          <button onClick={onClose} className="p-1.5 text-workshop-muted hover:text-workshop-text flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="overflow-y-auto flex-1">
          {/* ─── Quick search results ─── */}
          {!lookupMode && (
            <div>
              {query.length < 2 && (
                <div className="text-center py-12">
                  <Search className="h-10 w-10 text-workshop-muted/30 mx-auto mb-3" />
                  <p className="text-workshop-muted text-sm">
                    Skriv minst 2 tecken för att söka
                  </p>
                  <p className="text-workshop-muted/60 text-xs mt-1">
                    Söker kunder, fordon, arbetsorder
                  </p>
                </div>
              )}

              {query.length >= 2 && searchResults.length === 0 && !searching && (
                <div className="p-4 text-center text-workshop-muted text-sm">
                  Inga träffar i databasen
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1.5 text-[10px] text-workshop-muted uppercase tracking-wider">
                    Resultat ({searchResults.length})
                  </div>
                  {searchResults.map((item, i) => {
                    const Icon = TYPE_ICONS[item.type] ?? Search;
                    return (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                          i === selectedIdx
                            ? "bg-workshop-accent/15 text-workshop-text"
                            : "hover:bg-workshop-elevated text-workshop-text"
                        }`}
                        onMouseEnter={() => setSelectedIdx(i)}
                      >
                        <Icon className="h-4 w-4 text-workshop-muted flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-workshop-muted truncate">{item.subtitle}</p>
                          )}
                        </div>
                        {item.badge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Deep lookup option */}
              {query.length >= 2 && (
                <div className="border-t border-workshop-border">
                  <button
                    onClick={doDeepLookup}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                      selectedIdx === searchResults.length
                        ? "bg-workshop-accent/15"
                        : "hover:bg-workshop-elevated"
                    }`}
                    onMouseEnter={() => setSelectedIdx(searchResults.length)}
                  >
                    <div className="p-1.5 rounded-md bg-workshop-accent/20 flex-shrink-0">
                      <Car className="h-4 w-4 text-workshop-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-workshop-text">
                        Djupuppslag: {query.toUpperCase().replace(/[\s-]/g, "")}
                      </p>
                      <p className="text-xs text-workshop-muted">
                        Sök externt via biluppgifter.se, car.info
                      </p>
                    </div>
                    <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-workshop-bg border border-workshop-border text-[10px] text-workshop-muted font-mono">
                      Enter
                    </kbd>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── Deep lookup results ─── */}
          {lookupMode && (
            <div className="p-4">
              {/* Back button */}
              <button
                onClick={() => {
                  setLookupMode(false);
                  setLookupResult(null);
                  setLookupError("");
                }}
                className="text-xs text-workshop-accent hover:underline mb-3 flex items-center gap-1"
              >
                ← Tillbaka till sökresultat
              </button>

              {lookupLoading && (
                <div className="text-center py-12">
                  <Loader2 className="h-10 w-10 text-workshop-accent animate-spin mx-auto mb-4" />
                  <p className="text-workshop-text font-medium">Söker fordonsdata...</p>
                  <p className="text-workshop-muted text-sm mt-1">Kontrollerar databas och externa källor</p>
                </div>
              )}

              {lookupError && !lookupLoading && (
                <div className="text-center py-8">
                  <Car className="h-10 w-10 text-workshop-muted mx-auto mb-3" />
                  <p className="text-workshop-muted">{lookupError}</p>
                  <Link
                    href={`/vagnkort/ny?reg=${encodeURIComponent(query.toUpperCase().replace(/[\s-]/g, ""))}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-workshop-accent text-white rounded-lg text-sm font-medium hover:bg-workshop-accent-hover transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Registrera fordon manuellt
                  </Link>
                </div>
              )}

              {lookupResult?.found && !lookupLoading && (
                <div className="space-y-4">
                  {/* Vehicle card */}
                  <div className="bg-workshop-elevated rounded-xl p-5 border border-workshop-border">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="reg-plate text-sm">{lookupResult.vehicle?.regNr ?? query}</span>
                        {lookupResult.exists_in_db ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/40 text-green-300 border border-green-800">
                            I systemet
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-800">
                            Nytt fordon
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-workshop-muted">
                        {lookupResult.source === "local_db"
                          ? "Lokal databas"
                          : lookupResult.source?.includes("cache")
                            ? "Cache"
                            : lookupResult.source ?? "Extern källa"}
                      </span>
                    </div>

                    {lookupResult.vehicle && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <InfoField label="Märke" value={lookupResult.vehicle.brand} />
                        <InfoField label="Modell" value={lookupResult.vehicle.model} />
                        <InfoField label="Årsmodell" value={lookupResult.vehicle.modelYear} />
                        <InfoField label="Bränsle" value={lookupResult.vehicle.fuelType} />
                        <InfoField label="Växellåda" value={lookupResult.vehicle.transmission} />
                        <InfoField label="Färg" value={lookupResult.vehicle.color} />
                        {lookupResult.vehicle.vin && (
                          <InfoField label="VIN" value={lookupResult.vehicle.vin} className="col-span-2 sm:col-span-3 font-mono text-xs" />
                        )}
                      </div>
                    )}

                    {lookupResult.customer && (
                      <div className="mt-4 pt-4 border-t border-workshop-border">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-workshop-muted" />
                          <span className="text-xs text-workshop-muted uppercase tracking-wider">Ägare</span>
                        </div>
                        <p className="text-sm text-workshop-text font-medium">
                          {lookupResult.customer.companyName ??
                            `${lookupResult.customer.firstName ?? ""} ${lookupResult.customer.lastName ?? ""}`.trim()}
                        </p>
                        {lookupResult.customer.phone && (
                          <p className="text-xs text-workshop-muted">{lookupResult.customer.phone}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Service history */}
                  {lookupResult.service_history.length > 0 && (
                    <div className="bg-workshop-elevated rounded-xl p-5 border border-workshop-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Wrench className="h-4 w-4 text-workshop-muted" />
                        <span className="text-xs text-workshop-muted uppercase tracking-wider">
                          Servicehistorik ({lookupResult.service_history.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {lookupResult.service_history.map((wo: any) => {
                          const st = STATUS_LABELS[wo.status] ?? STATUS_LABELS.queued;
                          return (
                            <Link
                              key={wo.id}
                              href={`/arbetsorder/${wo.id}`}
                              onClick={onClose}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-workshop-bg hover:bg-workshop-surface transition-colors"
                            >
                              <div>
                                <span className="text-xs text-workshop-muted font-mono">{wo.orderNumber}</span>
                                {wo.customerComplaint && (
                                  <p className="text-xs text-workshop-text mt-0.5 truncate max-w-[250px]">
                                    {wo.customerComplaint}
                                  </p>
                                )}
                                {wo.receivedAt && (
                                  <p className="text-[10px] text-workshop-muted mt-0.5 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(wo.receivedAt).toLocaleDateString("sv-SE")}
                                  </p>
                                )}
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.color}`}>
                                {st.label}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3">
                    {!lookupResult.exists_in_db && (
                      <Link
                        href={`/vagnkort/ny?reg=${lookupResult.vehicle?.regNr ?? query}`}
                        onClick={onClose}
                        className="flex items-center gap-2 px-4 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Registrera fordon & skapa arbetsorder
                      </Link>
                    )}
                    {lookupResult.exists_in_db && (
                      <>
                        <Link
                          href={`/arbetsorder/ny?vehicleId=${lookupResult.vehicle?.id}`}
                          onClick={onClose}
                          className="flex items-center gap-2 px-4 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <Wrench className="h-4 w-4" />
                          Skapa arbetsorder
                        </Link>
                        <Link
                          href={`/vagnkort/${lookupResult.vehicle?.id}`}
                          onClick={onClose}
                          className="flex items-center gap-2 px-4 py-2.5 bg-workshop-elevated border border-workshop-border text-workshop-text rounded-lg text-sm hover:bg-workshop-surface transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Visa vagnkort
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-workshop-border px-4 py-2 flex items-center gap-4 text-[10px] text-workshop-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-workshop-bg border border-workshop-border font-mono">↑↓</kbd>
            navigera
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-workshop-bg border border-workshop-border font-mono">Enter</kbd>
            öppna
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-workshop-bg border border-workshop-border font-mono">Esc</kbd>
            stäng
          </span>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, className }: { label: string; value: any; className?: string }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className={className}>
      <p className="text-[10px] text-workshop-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm text-workshop-text font-medium">{value}</p>
    </div>
  );
}

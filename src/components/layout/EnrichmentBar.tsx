"use client";

import { useState } from "react";
import {
  Loader2, Sparkles, CheckCircle2, X, ChevronUp,
  ChevronDown, Car, AlertTriangle, AlertCircle,
} from "lucide-react";
import { useEnrichment, type EnrichEvent } from "./EnrichmentProvider";

/**
 * Global enrichment status bar — fixed at bottom of screen.
 * Shows current vehicle being enriched, progress, and a collapsible log.
 * Persists across page navigation since it lives in the layout.
 */
export function EnrichmentBar() {
  const { state, stopEnrich, dismiss } = useEnrichment();
  const [expanded, setExpanded] = useState(false);

  const { running, done, total, completed, enriched, errors, currentRegNr, currentBrand, currentModel, recentEvents, error } = state;

  // Don't show if nothing happening
  if (!running && !done && !error && recentEvents.length === 0 && total === 0) {
    return null;
  }

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-screen-xl mx-auto px-4 pb-4">
        <div className="pointer-events-auto bg-workshop-surface border border-workshop-border rounded-xl shadow-2xl overflow-hidden">
          {/* Main bar */}
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Icon */}
            {running ? (
              <Loader2 className="h-4 w-4 text-workshop-accent animate-spin flex-shrink-0" />
            ) : done ? (
              <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
            ) : error ? (
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0" />
            )}

            {/* Text */}
            <div className="flex-1 min-w-0">
              {running && currentRegNr && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-workshop-text">
                    Berikar fordon
                  </span>
                  <span className="reg-plate text-[10px]">{currentRegNr}</span>
                  {(currentBrand || currentModel) && (
                    <span className="text-xs text-workshop-muted">
                      {currentBrand !== "Okänt" ? currentBrand : ""} {currentModel !== "Okänt" ? currentModel : ""}
                    </span>
                  )}
                  <span className="text-xs text-workshop-muted ml-auto hidden sm:block">
                    {completed + 1}/{total}
                  </span>
                </div>
              )}
              {running && !currentRegNr && (
                <span className="text-sm text-workshop-text">Startar berikning...</span>
              )}
              {done && (
                <span className="text-sm text-green-400">
                  Klar! {enriched} fordon berikade
                  {errors > 0 && <span className="text-red-400 ml-1">· {errors} fel</span>}
                </span>
              )}
              {error && !running && (
                <span className="text-sm text-red-400">{error}</span>
              )}
            </div>

            {/* Progress bar (inline) */}
            {running && total > 0 && (
              <div className="w-24 h-1.5 bg-workshop-elevated rounded-full overflow-hidden flex-shrink-0 hidden sm:block">
                <div
                  className="h-full bg-workshop-accent rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {running && (
              <span className="text-[10px] text-workshop-muted font-mono flex-shrink-0">
                {pct}%
              </span>
            )}

            {/* Expand/collapse */}
            {recentEvents.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 text-workshop-muted hover:text-workshop-text flex-shrink-0"
                title={expanded ? "Minimera" : "Visa logg"}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Stop/Close */}
            {running ? (
              <button
                onClick={stopEnrich}
                className="p-1 text-workshop-muted hover:text-red-400 flex-shrink-0"
                title="Avbryt"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="p-1 text-workshop-muted hover:text-workshop-text flex-shrink-0"
                title="Stäng"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Expanded log */}
          {expanded && recentEvents.length > 0 && (
            <div className="border-t border-workshop-border max-h-[200px] overflow-y-auto">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2.5 px-4 py-1.5 text-xs border-b border-workshop-border/30 last:border-b-0"
                >
                  <EventIcon type={event.type} />
                  <span className="reg-plate text-[9px] flex-shrink-0">{event.regNr}</span>
                  {event.type === "enriched" && (
                    <span className="text-green-400 flex-1 min-w-0 truncate">
                      {event.brand} {event.model}
                      {event.year ? ` ${event.year}` : ""}
                      {event.engineCode ? ` · ${event.engineCode}` : ""}
                    </span>
                  )}
                  {event.type === "error" && (
                    <span className="text-red-400 flex-1 min-w-0 truncate">
                      {event.message}
                    </span>
                  )}
                  {event.type === "captcha" && (
                    <span className="text-amber-400 flex-1 min-w-0 truncate">
                      CAPTCHA — hoppas över
                    </span>
                  )}
                  <span className="text-workshop-muted/50 flex-shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString("sv-SE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  if (type === "enriched") return <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />;
  if (type === "error") return <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />;
  if (type === "captcha") return <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />;
  return <Car className="h-3 w-3 text-workshop-muted flex-shrink-0" />;
}

"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Package, ChevronDown, ChevronUp } from "lucide-react";

interface MissingPart {
  partId: string;
  partName: string;
  partNumber: string;
  needed: number;
  inStock: number;
  shortfall: number;
}

interface PartsAlertItem {
  appointmentId: string;
  workOrderId: string;
  scheduledStart: string;
  vehicleRegNr: string;
  missingParts: MissingPart[];
}

interface Props {
  weekStart: string;
  weekEnd: string;
}

export function PartsAlert({ weekStart, weekEnd }: Props) {
  const [alerts, setAlerts] = useState<PartsAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch(
          `/api/kalender/parts-check?start=${encodeURIComponent(weekStart)}&end=${encodeURIComponent(weekEnd)}`,
        );
        if (res.ok) {
          const body = await res.json();
          setAlerts(body.data ?? []);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();
  }, [weekStart, weekEnd]);

  if (loading || alerts.length === 0) return null;

  const totalMissing = alerts.reduce((sum, a) => sum + a.missingParts.length, 0);

  return (
    <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-950/40 transition-colors"
      >
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-amber-300">
            {alerts.length} bokning{alerts.length !== 1 ? "ar" : ""} saknar delar i lager
          </span>
          <span className="text-xs text-amber-500 ml-2">
            ({totalMissing} artikl{totalMissing !== 1 ? "ar" : "el"})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-500" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 space-y-3 border-t border-amber-800/30">
          {alerts.map((alert) => {
            const date = new Date(alert.scheduledStart);
            const dayStr = date.toLocaleDateString("sv-SE", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const timeStr = date.toLocaleTimeString("sv-SE", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={alert.appointmentId} className="pt-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono font-bold text-sm text-amber-200">
                    {alert.vehicleRegNr}
                  </span>
                  <span className="text-xs text-amber-500">
                    {dayStr} {timeStr}
                  </span>
                </div>
                <div className="space-y-1 pl-2">
                  {alert.missingParts.map((part) => (
                    <div
                      key={part.partId}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Package className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="text-amber-300 flex-1 truncate">
                        {part.partName}
                      </span>
                      <span className="text-amber-500 font-mono shrink-0">
                        {part.partNumber}
                      </span>
                      <span className="text-red-400 font-mono shrink-0">
                        -{part.shortfall}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Returns a Set of appointment IDs that have missing parts.
 * Used by the calendar to highlight those appointments.
 */
export function usePartsAlerts(weekStart: string, weekEnd: string) {
  const [alertIds, setAlertIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(
          `/api/kalender/parts-check?start=${encodeURIComponent(weekStart)}&end=${encodeURIComponent(weekEnd)}`,
        );
        if (res.ok) {
          const body = await res.json();
          const ids = new Set<string>((body.data ?? []).map((a: any) => a.appointmentId));
          setAlertIds(ids);
        }
      } catch {
        // Silent fail
      }
    }
    fetch_();
  }, [weekStart, weekEnd]);

  return alertIds;
}

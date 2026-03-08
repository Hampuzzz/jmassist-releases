"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Wifi, KeyRound, RefreshCw } from "lucide-react";
import Link from "next/link";

type ScraperStatus = {
  serviceRunning: boolean;
  carinfo: {
    hasCookies: boolean;
    tokenValid: boolean;
    tokenExpiresAt: string | null;
    blocked: boolean;
  };
  biluppgifter: {
    hasCookies: boolean;
    cfClearanceValid: boolean;
    cfClearanceExpiresAt: string | null;
  };
  warnings: string[];
};

/**
 * ScraperStatusBanner — shows on the dashboard when scraper login needs renewal.
 * Only renders when there are warnings (silent when everything is OK).
 */
export function ScraperStatusBanner() {
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/scraper/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Scraper not available — don't show anything on dashboard
    } finally {
      setLoading(false);
    }
  }

  // Don't render anything if loading, dismissed, no status, or no warnings
  if (loading || dismissed || !status || status.warnings.length === 0) {
    return null;
  }

  const hasTokenIssue =
    !status.carinfo.tokenValid || !status.biluppgifter.cfClearanceValid;
  const serviceDown = !status.serviceRunning;

  return (
    <div
      className={`surface rounded-lg p-4 border-l-4 ${
        serviceDown
          ? "border-red-600"
          : hasTokenIssue
            ? "border-amber-600"
            : "border-amber-600"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {serviceDown ? (
            <Wifi className="h-5 w-5 text-red-400" />
          ) : (
            <KeyRound className="h-5 w-5 text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              serviceDown ? "text-red-300" : "text-amber-300"
            }`}
          >
            {serviceDown
              ? "Fordonsuppslagning offline"
              : "Fordonsuppslagning: Inloggning krävs"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {status.warnings.map((w, i) => (
              <li key={i} className="text-xs text-workshop-muted flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 mt-2">
            <Link
              href="/vagnkort"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-800 text-amber-300 rounded-md text-xs font-medium transition-colors"
            >
              <KeyRound className="h-3 w-3" />
              Gå till Vagnkort
            </Link>
            <button
              onClick={() => {
                setDismissed(false);
                fetchStatus();
              }}
              className="inline-flex items-center gap-1 text-xs text-workshop-muted hover:text-workshop-text transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Uppdatera
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-workshop-muted hover:text-workshop-text transition-colors ml-auto"
            >
              Dölj
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

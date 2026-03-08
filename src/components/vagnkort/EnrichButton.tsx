"use client";

import { useState } from "react";
import { RefreshCw, Check, X } from "lucide-react";

type EnrichResult = {
  ok: boolean;
  updated: string[];
  message: string;
  error?: string;
};

type Props = {
  vehicleId: string;
  regNr: string;
  /** Called after successful enrichment (e.g. to refresh data) */
  onEnriched?: () => void;
  /** Show label text next to icon */
  showLabel?: boolean;
};

export function EnrichButton({ vehicleId, regNr, onEnriched, showLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleEnrich(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/vagnkort/${vehicleId}/enrich`, {
        method: "POST",
      });

      const data: EnrichResult = await res.json();

      if (!res.ok || data.error) {
        setResult({ ok: false, message: data.error ?? "Okänt fel" });
      } else {
        setResult({
          ok: true,
          message: data.updated?.length > 0
            ? `${data.updated.length} fält uppdaterade`
            : "Ingen ny data",
        });
        onEnriched?.();
      }
    } catch (err: any) {
      setResult({ ok: false, message: "Nätverksfel" });
    } finally {
      setLoading(false);
      // Clear result after 3 seconds
      setTimeout(() => setResult(null), 3000);
    }
  }

  if (result) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium ${
          result.ok ? "text-green-400" : "text-red-400"
        }`}
        title={result.message}
      >
        {result.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        {showLabel && <span>{result.message}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={handleEnrich}
      disabled={loading}
      title={`Berika ${regNr} från extern databas`}
      className={`inline-flex items-center gap-1.5 text-workshop-muted hover:text-workshop-accent transition-colors disabled:opacity-50 ${
        showLabel
          ? "px-3 py-1.5 text-sm border border-workshop-border rounded-md hover:bg-workshop-elevated"
          : ""
      }`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {showLabel && <span>{loading ? "Hämtar..." : "Berika"}</span>}
    </button>
  );
}

"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, ArrowUpCircle, AlertCircle } from "lucide-react";

type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  latestTag: string;
  updateAvailable: boolean;
  repoUrl: string;
  downloadUrl: string | null;
  error?: string;
};

export function UpdateChecker() {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState("");

  async function checkForUpdate() {
    setLoading(true);
    setError("");
    setInfo(null);

    try {
      const res = await fetch("/api/update/check");
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Kunde inte kontrollera uppdateringar");
        return;
      }

      setInfo(data);
    } catch {
      setError("Nätverksfel — kunde inte nå servern");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-workshop-text">Programuppdatering</h3>
          <p className="text-sm text-workshop-muted">
            Kontrollera om det finns en ny version av JM Assist
          </p>
        </div>
        <button
          onClick={checkForUpdate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Söker..." : "Sök efter uppdatering"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {info && !info.updateAvailable && (
        <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-200 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Du har senaste versionen (v{info.currentVersion})
        </div>
      )}

      {info?.updateAvailable && (
        <div className="p-3 bg-amber-900/30 border border-amber-800 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-amber-200 text-sm">
            <ArrowUpCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              Ny version tillgänglig: <strong>v{info.latestVersion}</strong>
              {" "}(du har v{info.currentVersion})
            </span>
          </div>
          {info.downloadUrl && (
            <a
              href={info.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium transition-colors"
            >
              Ladda ner uppdatering
            </a>
          )}
        </div>
      )}
    </div>
  );
}

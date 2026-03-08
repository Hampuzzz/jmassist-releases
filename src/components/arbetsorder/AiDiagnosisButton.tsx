"use client";

import { useState, useCallback } from "react";
import { Bot, X, AlertTriangle, Clock, Wrench, Package, Loader2, Sparkles } from "lucide-react";

interface DiagnosisResult {
  code: string;
  description: string;
  causes: string[];
  repair: string;
  estimatedHours: string;
  parts: string[];
  severity: "low" | "medium" | "high";
}

interface Props {
  vehicleId?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
}

export function AiDiagnosisButton({ vehicleId, vehicleMake, vehicleModel, vehicleYear }: Props) {
  const [open, setOpen] = useState(false);
  const [dtcCode, setDtcCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDiagnose = useCallback(async () => {
    if (!dtcCode.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/ai/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dtcCode: dtcCode.trim().toUpperCase(),
          vehicleId,
          vehicleMake,
          vehicleModel,
          vehicleYear,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Fel (HTTP ${res.status})`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? "AI-diagnos misslyckades.");
    } finally {
      setLoading(false);
    }
  }, [dtcCode, vehicleId, vehicleMake, vehicleModel, vehicleYear]);

  const severityColors = {
    low: "text-green-400 bg-green-900/20",
    medium: "text-amber-400 bg-amber-900/20",
    high: "text-red-400 bg-red-900/20",
  };

  const severityLabels = {
    low: "Låg",
    medium: "Medel",
    high: "Hög",
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 rounded-md text-sm font-medium transition-colors"
      >
        <Bot className="h-4 w-4" />
        AI-Diagnos
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-workshop-surface border border-workshop-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-workshop-border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <h2 className="text-lg font-semibold text-workshop-text">AI-Diagnoshjälp</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-workshop-elevated rounded-md text-workshop-muted hover:text-workshop-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-4">
              {/* Vehicle info */}
              {(vehicleMake || vehicleModel) && (
                <div className="text-xs text-workshop-muted bg-workshop-elevated px-3 py-2 rounded-md">
                  Fordon: {vehicleMake} {vehicleModel} {vehicleYear ? `(${vehicleYear})` : ""}
                </div>
              )}

              {/* DTC input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-workshop-text">Felkod (DTC)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dtcCode}
                    onChange={(e) => setDtcCode(e.target.value.toUpperCase())}
                    placeholder="T.ex. P0301, P0171, B1234..."
                    className="flex-1 px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => e.key === "Enter" && handleDiagnose()}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleDiagnose}
                    disabled={loading || !dtcCode.trim()}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyserar...
                      </>
                    ) : (
                      "Analysera"
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-md">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="space-y-4 pt-2">
                  {/* Severity + Code */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold text-workshop-text">{result.code}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${severityColors[result.severity]}`}>
                      Allvarlighet: {severityLabels[result.severity]}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="bg-workshop-elevated rounded-lg p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-1">Beskrivning</h4>
                      <p className="text-sm text-workshop-text">{result.description}</p>
                    </div>

                    {/* Causes */}
                    <div>
                      <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Troliga orsaker
                      </h4>
                      <ul className="space-y-1">
                        {result.causes.map((cause, i) => (
                          <li key={i} className="text-sm text-workshop-text flex items-start gap-2">
                            <span className="text-workshop-accent mt-0.5">{i + 1}.</span>
                            {cause}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Repair */}
                    <div>
                      <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        Rekommenderad reparation
                      </h4>
                      <p className="text-sm text-workshop-text">{result.repair}</p>
                    </div>

                    {/* Estimated time */}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-workshop-muted" />
                      <span className="text-sm text-workshop-muted">Uppskattad tid:</span>
                      <span className="text-sm text-workshop-text font-medium">{result.estimatedHours}</span>
                    </div>

                    {/* Parts */}
                    {result.parts.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Reservdelar
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {result.parts.map((part, i) => (
                            <span
                              key={i}
                              className="text-xs bg-workshop-bg border border-workshop-border px-2.5 py-1 rounded-md text-workshop-text"
                            >
                              {part}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info disclaimer */}
                  <p className="text-xs text-workshop-muted/60 italic">
                    AI-genererad analys — verifiera alltid med manuell diagnostik.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

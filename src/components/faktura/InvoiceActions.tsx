"use client";

import { useState } from "react";
import { Printer, Send, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { INVOICE_STATUSES } from "@/lib/constants";

/** Maps each status to the label shown on the transition button */
const TRANSITION_LABELS: Record<string, string> = {
  sent:      "Markera som skickad",
  paid:      "Markera som betald",
  overdue:   "Markera som förfallen",
  cancelled: "Annullera",
};

interface Props {
  invoiceId: string;
  currentStatus: string;
  allowedTransitions: string[];
  fortnoxId: string | null;
  fortnoxSyncStatus: string;
  fortnoxErrorMsg: string | null;
  onOptimisticUpdate?: (newStatus: string) => void;
  onRollback?: () => void;
}

export function InvoiceActions({
  invoiceId,
  currentStatus,
  allowedTransitions,
  fortnoxId,
  fortnoxSyncStatus,
  fortnoxErrorMsg,
  onOptimisticUpdate,
  onRollback,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success?: boolean; message?: string } | null>(null);

  async function changeStatus(newStatus: string) {
    setLoading(newStatus);

    // Optimistic update — instant UI feedback
    onOptimisticUpdate?.(newStatus);

    try {
      const res = await fetch(`/api/faktura/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        onRollback?.();
        alert(body?.error ?? "Kunde inte byta status.");
      }
      // Success — optimistic state is already correct
    } catch {
      onRollback?.();
      alert("Nätverksfel \u2014 kunde inte byta status.");
    } finally {
      setLoading(null);
    }
  }

  async function syncToFortnox() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/faktura/${invoiceId}/fortnox`, {
        method: "POST",
      });
      const body = await res.json();
      if (res.ok) {
        setSyncResult({
          success: true,
          message: body.mock
            ? `Mock-synkad (${body.fortnoxId})`
            : `Synkad till Fortnox: ${body.fortnoxId}`,
        });
      } else {
        setSyncResult({ success: false, message: body.error ?? "Synkning misslyckades" });
      }
    } catch {
      setSyncResult({ success: false, message: "Nätverksfel vid synkning" });
    } finally {
      setSyncing(false);
    }
  }

  const isSynced = fortnoxSyncStatus === "synced";
  const isError = fortnoxSyncStatus === "error";

  const statusConfig = INVOICE_STATUSES[currentStatus as keyof typeof INVOICE_STATUSES];

  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      {/* Status badge (updates instantly) */}
      {statusConfig && (
        <span className={`status-badge ${statusConfig.color} transition-all duration-200`}>
          {statusConfig.label}
        </span>
      )}
      {loading && (
        <span className="text-xs text-workshop-muted animate-pulse">Sparar...</span>
      )}

      {/* Print / PDF button */}
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 bg-workshop-elevated hover:bg-workshop-border text-workshop-text rounded-md text-sm font-medium transition-colors"
      >
        <Printer className="h-4 w-4" />
        Skriv ut / PDF
      </button>

      {/* Send to customer - placeholder */}
      <div className="relative group">
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-workshop-elevated text-workshop-muted rounded-md text-sm font-medium cursor-not-allowed opacity-50"
        >
          <Send className="h-4 w-4" />
          Skicka till kund
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-zinc-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Kommer snart
        </div>
      </div>

      {/* Fortnox sync button */}
      <div className="relative group">
        {isSynced ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 text-green-400 rounded-md text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Fortnox: {fortnoxId}
          </div>
        ) : (
          <button
            onClick={syncToFortnox}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
              isError
                ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                : "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50"
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synkar..." : isError ? "Fortnox: Synka igen" : "Synka till Fortnox"}
          </button>
        )}
        {isError && fortnoxErrorMsg && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-red-900 text-red-200 text-xs rounded max-w-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{fortnoxErrorMsg}</span>
            </div>
          </div>
        )}
      </div>

      {/* Sync result toast */}
      {syncResult && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium ${
            syncResult.success
              ? "bg-green-900/30 text-green-400"
              : "bg-red-900/30 text-red-400"
          }`}
        >
          {syncResult.success ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {syncResult.message}
        </div>
      )}

      {/* Status transition buttons */}
      {allowedTransitions.length > 0 && (
        <>
          <span className="mx-1 h-6 border-l border-workshop-border" />
          {allowedTransitions.map((status) => {
            const config = INVOICE_STATUSES[status as keyof typeof INVOICE_STATUSES];
            const label = TRANSITION_LABELS[status] ?? config?.label ?? status;
            const isDestructive = status === "cancelled";
            return (
              <button
                key={status}
                onClick={() => changeStatus(status)}
                disabled={loading !== null}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 hover:opacity-80 ${
                  isDestructive
                    ? "bg-red-800 text-red-200"
                    : config?.color ?? "bg-zinc-700 text-zinc-200"
                }`}
              >
                {loading === status ? "..." : label}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

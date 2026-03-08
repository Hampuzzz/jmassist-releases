"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Copy, CheckCircle2, AlertCircle, Link2, Trash2 } from "lucide-react";
import { WORK_ORDER_STATUSES } from "@/lib/constants";

interface ApprovalInfo {
  id: string;
  status: string;
  token: string;
  expiresAt: string;
}

interface Props {
  orderId: string;
  currentStatus: string;
  allowedTransitions: string[];
  approvalRequests?: ApprovalInfo[];
  onOptimisticUpdate?: (newStatus: string) => void;
  onRollback?: () => void;
}

export function WorkOrderActions({
  orderId,
  currentStatus,
  allowedTransitions,
  approvalRequests = [],
  onOptimisticUpdate,
  onRollback,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingApproval, setCreatingApproval] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{
    success?: boolean;
    message?: string;
    url?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function changeStatus(newStatus: string) {
    setLoading(newStatus);

    // Optimistic update — instant UI feedback
    onOptimisticUpdate?.(newStatus);

    try {
      const res = await fetch(`/api/arbetsorder/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        // Rollback on error
        onRollback?.();
        alert(body?.error ?? "Kunde inte byta status.");
      }
      // Success — optimistic state is already correct, no router.refresh needed
    } catch {
      onRollback?.();
      alert("Nätverksfel \u2014 kunde inte byta status.");
    } finally {
      setLoading(null);
    }
  }

  async function createApproval() {
    setCreatingApproval(true);
    setApprovalResult(null);
    try {
      const res = await fetch(`/api/arbetsorder/${orderId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (res.ok) {
        setApprovalResult({
          success: true,
          message: `Godkännande skapat (${body.itemCount} punkter)`,
          url: body.publicUrl,
        });
      } else {
        setApprovalResult({
          success: false,
          message: body.error ?? "Kunde inte skapa godkännande.",
        });
      }
    } catch {
      setApprovalResult({
        success: false,
        message: "Nätverksfel vid skapande av godkännande.",
      });
    } finally {
      setCreatingApproval(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Kopiera denna länk:", url);
    }
  }

  async function deleteOrder() {
    if (!confirm("Är du säker på att du vill ta bort denna arbetsorder? Allt relaterat (uppgifter, delar, hälsokontroll, godkännanden) raderas permanent.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/arbetsorder/${orderId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/arbetsorder");
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte ta bort arbetsorder.");
      }
    } catch {
      alert("Nätverksfel — kunde inte ta bort arbetsorder.");
    } finally {
      setDeleting(false);
    }
  }

  // Latest pending/active approval
  const latestApproval = approvalRequests.length > 0 ? approvalRequests[0] : null;
  const approvalStatusLabels: Record<string, { label: string; color: string }> = {
    pending:            { label: "Väntar på svar", color: "text-amber-400" },
    approved:           { label: "Godkänd", color: "text-green-400" },
    partially_approved: { label: "Delvis godkänd", color: "text-amber-400" },
    denied:             { label: "Avslagen", color: "text-red-400" },
  };

  const statusConfig = WORK_ORDER_STATUSES[currentStatus as keyof typeof WORK_ORDER_STATUSES];

  return (
    <div className="space-y-3">
      {/* Current status badge (updates instantly) */}
      {statusConfig && (
        <div className="flex items-center gap-2">
          <span className={`status-badge ${statusConfig.color} transition-all duration-200`}>
            {statusConfig.label}
          </span>
          {loading && (
            <span className="text-xs text-workshop-muted animate-pulse">Sparar...</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Status transition buttons */}
        {allowedTransitions.length > 0 && (
          <>
            <span className="text-xs text-workshop-muted self-center mr-1">Byt status:</span>
            {allowedTransitions.map((status) => {
              const config = WORK_ORDER_STATUSES[status as keyof typeof WORK_ORDER_STATUSES];
              if (!config) return null;
              return (
                <button
                  key={status}
                  onClick={() => changeStatus(status)}
                  disabled={loading !== null}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${config.color} hover:opacity-80`}
                >
                  {loading === status ? "..." : config.label}
                </button>
              );
            })}
          </>
        )}

        {/* Separator */}
        {allowedTransitions.length > 0 && (
          <span className="mx-1 h-6 border-l border-workshop-border self-center" />
        )}

        {/* Approval button */}
        <button
          onClick={createApproval}
          disabled={creatingApproval}
          className="flex items-center gap-2 px-4 py-2 bg-purple-900/30 text-purple-400 hover:bg-purple-900/50 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <ClipboardCheck className={`h-4 w-4 ${creatingApproval ? "animate-pulse" : ""}`} />
          {creatingApproval ? "Skapar..." : "Skicka godkännande"}
        </button>

        {/* Separator */}
        <span className="mx-1 h-6 border-l border-workshop-border self-center" />

        {/* Delete button */}
        <button
          onClick={deleteOrder}
          disabled={deleting}
          className="flex items-center gap-2 px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Trash2 className={`h-4 w-4 ${deleting ? "animate-pulse" : ""}`} />
          {deleting ? "Tar bort..." : "Ta bort"}
        </button>
      </div>

      {/* Approval result */}
      {approvalResult && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
            approvalResult.success
              ? "bg-green-900/20 text-green-400"
              : "bg-red-900/20 text-red-400"
          }`}
        >
          {approvalResult.success ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{approvalResult.message}</span>
          {approvalResult.url && (
            <button
              onClick={() => copyUrl(approvalResult.url!)}
              className="ml-auto flex items-center gap-1.5 px-2 py-1 bg-workshop-elevated rounded text-xs hover:bg-workshop-border transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Kopierad!" : "Kopiera länk"}
            </button>
          )}
        </div>
      )}

      {/* Existing approval requests */}
      {latestApproval && !approvalResult && (
        <div className="flex items-center gap-2 px-3 py-2 bg-workshop-elevated rounded-md text-sm">
          <Link2 className="h-4 w-4 text-workshop-muted shrink-0" />
          <span className="text-workshop-muted">Senaste godkännande:</span>
          <span className={approvalStatusLabels[latestApproval.status]?.color ?? "text-zinc-400"}>
            {approvalStatusLabels[latestApproval.status]?.label ?? latestApproval.status}
          </span>
          <button
            onClick={() =>
              copyUrl(`${window.location.origin}/godkann/${latestApproval.token}`)
            }
            className="ml-auto flex items-center gap-1 px-2 py-0.5 text-xs text-workshop-muted hover:text-workshop-text transition-colors"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Kopierad!" : "Kopiera"}
          </button>
        </div>
      )}
    </div>
  );
}

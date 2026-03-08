"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ExternalLink, Loader2 } from "lucide-react";

interface GenerateInvoiceButtonProps {
  workOrderId: string;
  invoiceId: string | null;
  quoteIds?: { id: string; invoiceNumber: string }[];
}

export function GenerateInvoiceButton({ workOrderId, invoiceId, quoteIds: _quoteIds }: GenerateInvoiceButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If invoice already exists, show link to it
  if (invoiceId) {
    return (
      <a
        href={`/faktura/${invoiceId}`}
        className="flex items-center gap-2 px-4 py-2.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-md text-sm font-medium transition-colors"
      >
        <FileText className="h-4 w-4" />
        Visa faktura
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/arbetsorder/${workOrderId}/faktura`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.status === 409) {
        // Invoice already existed — redirect to it
        router.push(`/faktura/${data.invoiceId}`);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Kunde inte skapa faktura");
        return;
      }

      // Success — redirect to the new invoice
      router.push(`/faktura/${data.invoiceId}`);
    } catch (err: any) {
      setError(err.message ?? "Nätverksfel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {loading ? "Skapar faktura…" : "Skapa faktura"}
      </button>
      {error && (
        <p className="text-red-400 text-xs mt-1.5">{error}</p>
      )}
    </div>
  );
}

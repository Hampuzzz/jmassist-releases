"use client";

import { useState, useEffect } from "react";
import { Smartphone, Loader2 } from "lucide-react";

interface Props {
  invoiceId: string;
  totalIncVat: string;
}

export function SwishQR({ invoiceId, totalIncVat }: Props) {
  const [qrData, setQrData] = useState<{
    svg: string;
    dataUrl: string;
    amount: string;
    message: string;
    swishNumber: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  async function loadQR() {
    if (qrData) {
      setVisible(!visible);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/faktura/${invoiceId}/swish-qr`);
      const body = await res.json();
      if (res.ok) {
        setQrData(body.data);
        setVisible(true);
      } else {
        setError(body.error ?? "Kunde inte skapa QR-kod");
      }
    } catch {
      setError("Nätverksfel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="no-print">
      {/* Toggle button */}
      <button
        onClick={loadQR}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-[#018A54]/20 text-[#018A54] hover:bg-[#018A54]/30 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Smartphone className="h-4 w-4" />
        )}
        Swish QR
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}

      {/* QR display */}
      {visible && qrData && (
        <div className="mt-3 p-4 bg-white rounded-lg inline-block print-block">
          <div className="text-center space-y-2">
            {/* Swish logo-like header */}
            <div className="flex items-center justify-center gap-2">
              <div className="bg-[#018A54] rounded-full p-1.5">
                <Smartphone className="h-4 w-4 text-white" />
              </div>
              <span className="text-[#018A54] font-bold text-sm">
                Betala med Swish
              </span>
            </div>

            {/* QR Code */}
            <div
              dangerouslySetInnerHTML={{ __html: qrData.svg }}
              className="mx-auto"
            />

            {/* Details */}
            <div className="text-xs text-gray-600 space-y-0.5">
              <p className="font-mono">{qrData.swishNumber}</p>
              <p className="font-bold text-gray-800 text-sm">
                {parseFloat(qrData.amount).toLocaleString("sv-SE", {
                  style: "currency",
                  currency: "SEK",
                })}
              </p>
              <p className="text-gray-500">Ref: {qrData.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

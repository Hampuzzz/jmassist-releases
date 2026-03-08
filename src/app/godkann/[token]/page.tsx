"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle, Car, Wrench, MessageSquare } from "lucide-react";

interface ApprovalItem {
  id: string;
  description: string;
  estimatedCost: string | null;
  photoUrls: string[];
  approved: boolean | null;
  customerNote: string;
  sortOrder: number;
}

interface ApprovalData {
  id: string;
  status: string;
  customerMessage: string | null;
  respondedAt: string | null;
  expiresAt: string;
  createdAt: string;
  orderNumber: string;
  vehicleRegNr: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number | null;
  customerFirst: string | null;
  customerLast: string | null;
  customerCompany: string | null;
  workshopName: string;
  items: ApprovalItem[];
}

export default function ApprovalPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ApprovalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/approval/${token}`);
        const body = await res.json();
        if (res.ok) {
          setData(body.data);
          // Pre-fill decisions if already responded
          if (body.data.status !== "pending") {
            const d: Record<string, boolean> = {};
            const n: Record<string, string> = {};
            for (const item of body.data.items) {
              if (item.approved !== null) d[item.id] = item.approved;
              if (item.customerNote) n[item.id] = item.customerNote;
            }
            setDecisions(d);
            setNotes(n);
            setSubmitted(true);
          }
        } else {
          setError(body.error ?? "Kunde inte ladda sidan.");
        }
      } catch {
        setError("Nätverksfel — försök igen senare.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  function toggleDecision(id: string, approved: boolean) {
    setDecisions((prev) => ({ ...prev, [id]: approved }));
  }

  async function handleSubmit() {
    if (!data) return;

    // Check that all items have a decision
    const undecided = data.items.filter((i) => decisions[i.id] === undefined);
    if (undecided.length > 0) {
      alert("Vänligen godkänn eller avslå alla punkter innan du skickar.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/approval/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: data.items.map((item) => ({
            id: item.id,
            approved: decisions[item.id],
            customerNote: notes[item.id] || undefined,
          })),
          message: message || undefined,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte skicka svar.");
      }
    } catch {
      alert("Nätverksfel — försök igen.");
    } finally {
      setSubmitting(false);
    }
  }

  // Format currency
  function formatCurrency(value: string | number) {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(num);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="animate-pulse text-lg">Laddar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="text-xl font-bold text-zinc-100">Något gick fel</h1>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const customerName = data.customerCompany ??
    [data.customerFirst, data.customerLast].filter(Boolean).join(" ") ?? "Kund";

  // Submitted / already responded view
  if (submitted) {
    const approvedCount = Object.values(decisions).filter(Boolean).length;
    const deniedCount = Object.values(decisions).filter((v) => !v).length;

    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
          <h1 className="text-2xl font-bold text-zinc-100">Tack!</h1>
          <p className="text-zinc-400">
            Ditt svar har registrerats.
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <span className="text-green-400">{approvedCount} godkänd(a)</span>
            {deniedCount > 0 && (
              <span className="text-red-400">{deniedCount} avslagna</span>
            )}
          </div>
          <p className="text-zinc-500 text-sm">
            Verkstaden kontaktar dig inom kort.
          </p>
        </div>
      </div>
    );
  }

  const totalEstimated = data.items.reduce(
    (sum, item) => sum + (item.estimatedCost ? parseFloat(item.estimatedCost) : 0),
    0,
  );

  return (
    <div className="min-h-screen bg-zinc-950 pb-8">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Wrench className="h-4 w-4" />
            <span>{data.workshopName}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-100">
            Godkännande av reparation
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 bg-zinc-800 rounded-md px-3 py-1.5">
              <Car className="h-4 w-4 text-zinc-400" />
              <span className="font-mono font-bold text-zinc-200">{data.vehicleRegNr}</span>
              <span className="text-zinc-400">
                {data.vehicleBrand} {data.vehicleModel}
                {data.vehicleYear ? ` (${data.vehicleYear})` : ""}
              </span>
            </div>
            {data.orderNumber && (
              <span className="text-zinc-500">Order: {data.orderNumber}</span>
            )}
          </div>
          <p className="text-zinc-400 text-sm">
            Hej {customerName}! Vi har hittat följande punkter som behöver åtgärdas.
            Vänligen godkänn eller avslå varje punkt nedan.
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        {data.items.map((item, i) => {
          const isApproved = decisions[item.id] === true;
          const isDenied = decisions[item.id] === false;
          const hasDecision = decisions[item.id] !== undefined;

          return (
            <div
              key={item.id}
              className={`rounded-lg border transition-colors ${
                isApproved
                  ? "border-green-700 bg-green-950/20"
                  : isDenied
                  ? "border-red-700 bg-red-950/20"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              <div className="p-4 space-y-3">
                {/* Description */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs text-zinc-500 font-medium">
                      Punkt {i + 1}
                    </span>
                    <p className="text-zinc-100 font-medium mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  {item.estimatedCost && (
                    <div className="text-right shrink-0">
                      <span className="text-xs text-zinc-500">Uppskattad kostnad</span>
                      <p className="font-mono font-bold text-amber-400">
                        {formatCurrency(item.estimatedCost)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Photos */}
                {item.photoUrls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto py-1">
                    {item.photoUrls.map((url, j) => (
                      <a
                        key={j}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <img
                          src={url}
                          alt={`Bild ${j + 1}`}
                          className="h-24 w-24 rounded-md object-cover border border-zinc-700 hover:border-zinc-500 transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {/* Decision buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleDecision(item.id, true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isApproved
                        ? "bg-green-700 text-green-100"
                        : "bg-zinc-800 text-zinc-400 hover:bg-green-900/40 hover:text-green-300"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Godkänn
                  </button>
                  <button
                    onClick={() => toggleDecision(item.id, false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isDenied
                        ? "bg-red-700 text-red-100"
                        : "bg-zinc-800 text-zinc-400 hover:bg-red-900/40 hover:text-red-300"
                    }`}
                  >
                    <XCircle className="h-4 w-4" />
                    Avslå
                  </button>
                </div>

                {/* Optional note */}
                {hasDecision && (
                  <input
                    type="text"
                    placeholder="Kommentar (valfritt)..."
                    value={notes[item.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Total estimate */}
        {totalEstimated > 0 && (
          <div className="flex justify-between items-center px-4 py-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <span className="text-zinc-400 text-sm">Total uppskattad kostnad</span>
            <span className="font-mono font-bold text-amber-400 text-lg">
              {formatCurrency(totalEstimated)}
            </span>
          </div>
        )}

        {/* General message */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <MessageSquare className="h-4 w-4" />
            Meddelande till verkstaden (valfritt)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Skriv ett meddelande..."
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(decisions).length !== data.items.length}
          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Skickar..." : "Skicka svar"}
        </button>

        <p className="text-xs text-zinc-600 text-center">
          Denna länk går ut {new Date(data.expiresAt).toLocaleDateString("sv-SE")}.
        </p>
      </div>
    </div>
  );
}

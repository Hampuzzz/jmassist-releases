"use client";

import { useState, useCallback } from "react";
import {
  Video, X, ArrowLeft, ArrowRight, Send, Check, Copy, Loader2, AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { MediaCapture } from "@/components/media/MediaCapture";

interface Props {
  workOrderId: string;
  vehicleRegNr: string;
  customerPhone: string | null;
  customerName: string;
}

type Step = 1 | 2 | 3 | 4;

export function QuickVideoButton({ workOrderId, vehicleRegNr, customerPhone, customerName }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // Step 1 result
  const [uploadedMedia, setUploadedMedia] = useState<{
    id: string; url: string; fileName: string; fileType: string;
  } | null>(null);

  // Step 2 form
  const [label, setLabel] = useState("");
  const [comment, setComment] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");

  // Step 3 sending
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 4 result
  const [result, setResult] = useState<{
    checkupUrl: string;
    smsSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function resetAndClose() {
    setOpen(false);
    setStep(1);
    setUploadedMedia(null);
    setLabel("");
    setComment("");
    setEstimatedCost("");
    setSending(false);
    setError(null);
    setResult(null);
    setCopied(false);
  }

  const handleUploaded = useCallback((res: { id: string; url: string; fileName: string; fileType: string }) => {
    setUploadedMedia(res);
    setStep(2);
  }, []);

  async function handleSend(withSms: boolean) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/arbetsorder/${workOrderId}/quick-vhc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          comment: comment.trim() || undefined,
          estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
          mediaUrls: uploadedMedia ? [uploadedMedia.url] : [],
          sendSms: withSms,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Något gick fel");
        return;
      }

      setResult({ checkupUrl: data.checkupUrl, smsSent: data.smsSent });
      setStep(4);
    } catch (err: any) {
      setError(err.message ?? "Nätverksfel");
    } finally {
      setSending(false);
    }
  }

  async function handleCopyLink() {
    if (!result?.checkupUrl) return;
    try {
      await navigator.clipboard.writeText(result.checkupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback — select text
    }
  }

  const isVideo = uploadedMedia?.fileType?.startsWith("video/");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 rounded-md text-sm font-medium transition-colors"
      >
        <Video className="h-4 w-4" />
        Filma &amp; Skicka
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={resetAndClose}
    >
      <div
        className="bg-workshop-surface border border-workshop-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-workshop-border">
          <div>
            <h2 className="text-lg font-semibold text-workshop-text">
              {step === 1 && "Filma eller fotografera"}
              {step === 2 && "Beskriv problemet"}
              {step === 3 && "Skicka till kund"}
              {step === 4 && "Skickat!"}
            </h2>
            <p className="text-xs text-workshop-muted mt-0.5">{vehicleRegNr}</p>
          </div>
          <button
            onClick={resetAndClose}
            className="p-1.5 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 py-2 flex items-center gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-orange-500" : "bg-workshop-border"
              }`}
            />
          ))}
        </div>

        <div className="px-5 py-4">
          {/* STEP 1: Camera / Upload */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-workshop-muted">
                Filma felet eller ta ett foto direkt med kameran.
              </p>
              <MediaCapture
                workOrderId={workOrderId}
                onUploaded={handleUploaded}
              />
            </div>
          )}

          {/* STEP 2: Description + Cost */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Preview */}
              {uploadedMedia && (
                <div className="rounded-lg overflow-hidden border border-workshop-border">
                  {isVideo ? (
                    <video
                      src={uploadedMedia.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-48 object-contain bg-black"
                    />
                  ) : (
                    <img
                      src={uploadedMedia.url}
                      alt="Förhandsgranskning"
                      className="w-full max-h-48 object-contain bg-black"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-workshop-muted block mb-1">
                  Vad behöver åtgärdas? *
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="t.ex. Rostiga bromsskivor"
                  className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-workshop-muted block mb-1">
                  Kommentar till kunden
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Valfri beskrivning..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-workshop-muted block mb-1">
                  Uppskattad kostnad (kr)
                </label>
                <input
                  type="number"
                  step="1"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="t.ex. 2450"
                  className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border rounded-md text-workshop-text text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-sm text-workshop-muted hover:text-workshop-text"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Tillbaka
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!label.trim()}
                  className="flex items-center gap-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Nästa
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview + Send */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="bg-workshop-elevated rounded-lg border border-workshop-border p-4 space-y-2">
                {uploadedMedia && (
                  <div className="rounded-lg overflow-hidden border border-workshop-border mb-3">
                    {isVideo ? (
                      <video
                        src={uploadedMedia.url}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-36 object-contain bg-black"
                      />
                    ) : (
                      <img
                        src={uploadedMedia.url}
                        alt=""
                        className="w-full max-h-36 object-contain bg-black"
                      />
                    )}
                  </div>
                )}
                <p className="text-sm font-medium text-workshop-text">{label}</p>
                {comment && (
                  <p className="text-xs text-workshop-muted">{comment}</p>
                )}
                {estimatedCost && (
                  <p className="text-lg font-bold text-workshop-accent">
                    {formatCurrency(parseFloat(estimatedCost))}
                  </p>
                )}
              </div>

              {/* Send options */}
              {customerPhone ? (
                <button
                  onClick={() => handleSend(true)}
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-base transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  {sending ? "Skickar..." : `Skicka till ${customerName.split(" ")[0]} via SMS`}
                </button>
              ) : (
                <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-300">Kunden saknar telefonnummer</p>
                    <p className="text-xs text-amber-400/70 mt-0.5">
                      Du kan skapa länken ändå och skicka den manuellt.
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => handleSend(false)}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-workshop-elevated hover:bg-workshop-border text-workshop-muted rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {!customerPhone && sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {customerPhone ? "Skapa utan SMS" : "Skapa länk"}
              </button>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <button
                onClick={() => setStep(2)}
                disabled={sending}
                className="flex items-center gap-1 text-sm text-workshop-muted hover:text-workshop-text"
              >
                <ArrowLeft className="h-4 w-4" />
                Tillbaka
              </button>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === 4 && result && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-workshop-text">
                  {result.smsSent ? "SMS skickat!" : "Länk skapad!"}
                </p>
                <p className="text-sm text-workshop-muted mt-1">
                  {result.smsSent
                    ? `${customerName.split(" ")[0]} har fått ett SMS med länken.`
                    : "Kopiera länken nedan och skicka den manuellt."}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-workshop-elevated rounded-lg px-3 py-2">
                <input
                  type="text"
                  readOnly
                  value={result.checkupUrl}
                  className="flex-1 bg-transparent text-xs text-workshop-muted truncate border-none outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-3 py-1.5 bg-workshop-border hover:bg-workshop-muted/30 text-workshop-text rounded text-xs font-medium transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Kopierad!" : "Kopiera"}
                </button>
              </div>

              <button
                onClick={resetAndClose}
                className="px-6 py-2.5 bg-workshop-accent hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Stäng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

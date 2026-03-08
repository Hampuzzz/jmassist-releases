"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";

interface TimeSlot {
  start:        string;
  end:          string;
  resourceId:   string;
  resourceName: string;
}

interface AvailabilityDay {
  date:   string;
  isOpen: boolean;
  slots:  TimeSlot[];
}

interface BookingWidgetProps {
  apiUrl:       string;
  apiKey?:      string;
  serviceType?: string;
}

type Step = "date" | "slot" | "details" | "confirm";

/**
 * BookingWidget - Embeddable public booking component.
 *
 * Can be used as a standalone page or embedded via iframe.
 * Fetches availability from /api/availability and submits to /api/book.
 *
 * Usage on external website:
 * <iframe src="https://YOUR_TUNNEL_URL/boka" width="100%" height="600" frameborder="0"></iframe>
 */
export function BookingWidget({ apiUrl, apiKey, serviceType }: BookingWidgetProps) {
  const [step,        setStep]        = useState<Step>("date");
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [form, setForm] = useState({
    regNr:         "",
    customerName:  "",
    customerPhone: "",
    customerEmail: "",
    notes:         "",
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchAvailability() {
      setLoading(true);
      try {
        const url = `${apiUrl}/api/availability?days=30&duration_minutes=60`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Kunde inte hämta tider");
        const data = await res.json();
        setAvailability(data.data ?? []);
      } catch (err) {
        setError("Kunde inte ladda tillgängliga tider. Försök igen senare.");
      } finally {
        setLoading(false);
      }
    }
    fetchAvailability();
  }, [apiUrl]);

  const openDays = availability.filter((d) => d.isOpen && d.slots.length > 0);

  const slotsForDate = selectedDate
    ? (availability.find((d) => d.date === selectedDate)?.slots ?? [])
    : [];

  const handleSubmit = async () => {
    if (!selectedSlot || !selectedDate) return;
    setSubmitting(true);
    setError(null);

    try {
      const body = {
        regNr:          form.regNr,
        customerName:   form.customerName,
        customerPhone:  form.customerPhone,
        customerEmail:  form.customerEmail || undefined,
        requestedDate:  selectedDate,
        requestedTime:  format(parseISO(selectedSlot.start), "HH:mm"),
        serviceType:    serviceType,
        notes:          form.notes || undefined,
        durationMinutes: 60,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${apiUrl}/api/book`, {
        method:  "POST",
        headers,
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Bokning misslyckades");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Något gick fel");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-workshop-muted">
        <div className="animate-pulse">Laddar tider...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center p-8 space-y-4">
        <div className="text-4xl">✓</div>
        <h2 className="text-lg font-semibold text-workshop-text">Bokning mottagen!</h2>
        <p className="text-workshop-muted text-sm">
          Din bokning är registrerad och väntar på bekräftelse.
          Vi hör av oss inom kort.
        </p>
        <p className="text-workshop-accent font-mono text-sm">
          {selectedDate && format(parseISO(selectedDate), "d MMMM yyyy", { locale: sv })}
          {" kl. "}
          {selectedSlot && format(parseISO(selectedSlot.start), "HH:mm")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <h2 className="text-lg font-bold text-workshop-text">Boka tid</h2>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-300 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Step: Pick date */}
      {step === "date" && (
        <div className="space-y-3">
          <p className="text-sm text-workshop-muted">Välj ett datum:</p>
          <div className="grid grid-cols-3 gap-2">
            {openDays.slice(0, 21).map((day) => {
              const d = parseISO(day.date);
              return (
                <button
                  key={day.date}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setStep("slot");
                  }}
                  className="p-3 surface text-center hover:bg-workshop-elevated hover:border-workshop-accent transition-colors"
                >
                  <p className="text-xs text-workshop-muted capitalize">
                    {format(d, "EEE", { locale: sv })}
                  </p>
                  <p className="text-lg font-bold text-workshop-text">{format(d, "d")}</p>
                  <p className="text-xs text-workshop-muted">{format(d, "MMM", { locale: sv })}</p>
                  <p className="text-xs text-workshop-accent">{day.slots.length} tid{day.slots.length !== 1 ? "er" : ""}</p>
                </button>
              );
            })}
          </div>
          {openDays.length === 0 && (
            <p className="text-workshop-muted text-sm text-center py-4">
              Inga lediga tider de närmaste 30 dagarna
            </p>
          )}
        </div>
      )}

      {/* Step: Pick time slot */}
      {step === "slot" && selectedDate && (
        <div className="space-y-3">
          <button
            onClick={() => setStep("date")}
            className="text-sm text-workshop-accent hover:underline"
          >
            ← Byt datum
          </button>
          <p className="text-sm text-workshop-muted capitalize">
            {format(parseISO(selectedDate), "EEEE d MMMM", { locale: sv })}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {slotsForDate.map((slot) => (
              <button
                key={`${slot.start}-${slot.resourceId}`}
                onClick={() => {
                  setSelectedSlot(slot);
                  setStep("details");
                }}
                className="p-3 surface text-center hover:bg-workshop-elevated hover:border-workshop-accent transition-colors"
              >
                <p className="font-mono font-bold text-workshop-text">
                  {format(parseISO(slot.start), "HH:mm")}
                </p>
                <p className="text-xs text-workshop-muted">{slot.resourceName}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Contact details */}
      {step === "details" && (
        <div className="space-y-4">
          <button
            onClick={() => setStep("slot")}
            className="text-sm text-workshop-accent hover:underline"
          >
            ← Byt tid
          </button>
          <p className="text-sm text-workshop-muted">
            Vald tid: <span className="text-workshop-text font-medium">
              {selectedSlot && format(parseISO(selectedSlot.start), "d MMM HH:mm", { locale: sv })}
            </span>
          </p>

          <div className="space-y-3">
            {[
              { name: "regNr",         label: "Registreringsnummer *", type: "text",  placeholder: "ABC123" },
              { name: "customerName",  label: "Namn *",                type: "text",  placeholder: "Förnamn Efternamn" },
              { name: "customerPhone", label: "Telefon *",             type: "tel",   placeholder: "070-000 00 00" },
              { name: "customerEmail", label: "E-post",                type: "email", placeholder: "namn@exempel.se" },
            ].map((field) => (
              <div key={field.name} className="space-y-1">
                <label className="text-sm text-workshop-text">{field.label}</label>
                <input
                  type={field.type}
                  value={form[field.name as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border
                             rounded-md text-workshop-text placeholder-workshop-muted text-sm
                             focus:outline-none focus:ring-2 focus:ring-workshop-accent"
                />
              </div>
            ))}

            <div className="space-y-1">
              <label className="text-sm text-workshop-text">Meddelande / Feelbeskrivning</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Beskriv felet eller vad du vill utföra..."
                className="w-full px-3 py-2.5 bg-workshop-elevated border border-workshop-border
                           rounded-md text-workshop-text placeholder-workshop-muted text-sm
                           focus:outline-none focus:ring-2 focus:ring-workshop-accent resize-none"
              />
            </div>
          </div>

          <button
            onClick={() => {
              if (!form.regNr || !form.customerName || !form.customerPhone) {
                setError("Fyll i regnummer, namn och telefon");
                return;
              }
              setError(null);
              setStep("confirm");
            }}
            className="w-full py-3 bg-workshop-accent hover:bg-workshop-accent-hover text-white font-semibold rounded-md transition-colors"
          >
            Fortsätt
          </button>
        </div>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && (
        <div className="space-y-4">
          <button onClick={() => setStep("details")} className="text-sm text-workshop-accent hover:underline">
            ← Ändra uppgifter
          </button>

          <div className="surface p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-workshop-text">Bekräfta din bokning</h3>
            <div className="space-y-1 text-workshop-muted">
              <p><span className="text-workshop-text">Datum:</span> {selectedDate && format(parseISO(selectedDate), "d MMMM yyyy", { locale: sv })}</p>
              <p><span className="text-workshop-text">Tid:</span> {selectedSlot && format(parseISO(selectedSlot.start), "HH:mm")} – {selectedSlot && format(parseISO(selectedSlot.end), "HH:mm")}</p>
              <p><span className="text-workshop-text">Regnr:</span> <span className="font-mono">{form.regNr.toUpperCase()}</span></p>
              <p><span className="text-workshop-text">Namn:</span> {form.customerName}</p>
              <p><span className="text-workshop-text">Telefon:</span> {form.customerPhone}</p>
              {form.notes && <p><span className="text-workshop-text">Meddelande:</span> {form.notes}</p>}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-md transition-colors disabled:opacity-50"
          >
            {submitting ? "Skickar..." : "Bekräfta bokning"}
          </button>
        </div>
      )}
    </div>
  );
}

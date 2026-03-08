"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Building2, Car, Wrench, FileText,
  Loader2, ChevronRight, Phone, Mail, MapPin,
} from "lucide-react";
import DeleteButton from "@/components/DeleteButton";

type Customer = {
  id: string; isCompany: boolean; firstName: string | null; lastName: string | null;
  companyName: string | null; orgNr: string | null; personalNr: string | null;
  phone: string | null; phoneAlt: string | null; email: string | null;
  addressLine1: string | null; addressLine2: string | null;
  postalCode: string | null; city: string | null; country: string | null;
  defaultPaymentTermsDays: number; vatExempt: boolean; notes: string | null;
  createdAt: string; updatedAt: string;
};

type Vehicle = {
  id: string; regNr: string; brand: string; model: string;
  modelYear: number | null; mileageKm: number | null;
};

type WorkOrder = {
  id: string; orderNumber: string; status: string; receivedAt: string;
  vehicleRegNr?: string;
};

type Invoice = {
  id: string; invoiceNumber: string; status: string; totalInclVat: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-900/50 text-blue-300",
  in_progress: "bg-amber-900/50 text-amber-300",
  done: "bg-green-900/50 text-green-300",
  invoiced: "bg-purple-900/50 text-purple-300",
  delivered: "bg-zinc-700 text-zinc-300",
};
const STATUS_LABELS: Record<string, string> = {
  received: "Mottagen", in_progress: "Pågående", done: "Klar",
  invoiced: "Fakturerad", delivered: "Utlämnad",
};
const INV_STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-700 text-zinc-300",
  sent: "bg-blue-900/50 text-blue-300",
  paid: "bg-green-900/50 text-green-300",
  overdue: "bg-red-900/50 text-red-300",
  cancelled: "bg-zinc-800 text-zinc-400",
};
const INV_STATUS_LABELS: Record<string, string> = {
  draft: "Utkast", sent: "Skickad", paid: "Betald",
  overdue: "Förfallen", cancelled: "Makulerad",
};

function customerName(c: Customer) {
  return c.isCompany ? c.companyName ?? "–" : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "–";
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // Load customer
        const cRes = await fetch(`/api/kunder/${id}`);
        if (!cRes.ok) { setError("Kunden hittades inte"); setLoading(false); return; }
        const { data: c } = await cRes.json();
        setCustomer(c);

        // Load vehicles for this customer
        const vRes = await fetch(`/api/vagnkort?customer_id=${id}`);
        if (vRes.ok) {
          const { data: v } = await vRes.json();
          setVehicles(v ?? []);
        }

        // Load work orders for this customer
        const woRes = await fetch(`/api/arbetsorder?customer_id=${id}`);
        if (woRes.ok) {
          const { data: wo } = await woRes.json();
          setWorkOrders(wo ?? []);
        }

        // Load invoices for this customer
        const iRes = await fetch(`/api/faktura?customer_id=${id}`);
        if (iRes.ok) {
          const { data: inv } = await iRes.json();
          setInvoices(inv ?? []);
        }
      } catch {
        setError("Kunde inte ladda kunddata");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-workshop-accent" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <User className="h-12 w-12 text-workshop-muted mx-auto mb-4" />
        <h2 className="text-xl font-bold text-workshop-text mb-2">Kunden hittades inte</h2>
        <Link href="/kunder" className="text-workshop-accent hover:underline text-sm">
          ← Tillbaka till kundregistret
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/kunder" className="p-2 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              {customer.isCompany
                ? <Building2 className="h-6 w-6 text-blue-400" />
                : <User className="h-6 w-6 text-workshop-muted" />}
              <h1 className="text-2xl font-bold text-workshop-text">{customerName(customer)}</h1>
            </div>
            {customer.isCompany && customer.orgNr && (
              <p className="text-workshop-muted text-sm ml-9">Org.nr: {customer.orgNr}</p>
            )}
            {!customer.isCompany && customer.personalNr && (
              <p className="text-workshop-muted text-sm ml-9">Personnr: {customer.personalNr}</p>
            )}
          </div>
        </div>
        <DeleteButton
          id={customer.id}
          endpoint="/api/kunder"
          confirmMessage="Är du säker på att du vill ta bort denna kund?"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">{error}</div>
      )}

      {/* Contact & Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface p-4 space-y-3">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Kontakt</h3>
          <div className="space-y-2">
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-workshop-muted flex-shrink-0" />
                <a href={`tel:${customer.phone}`} className="text-workshop-text hover:text-workshop-accent">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.phoneAlt && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-workshop-muted flex-shrink-0" />
                <a href={`tel:${customer.phoneAlt}`} className="text-workshop-text hover:text-workshop-accent">
                  {customer.phoneAlt} <span className="text-workshop-muted">(alt)</span>
                </a>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-workshop-muted flex-shrink-0" />
                <a href={`mailto:${customer.email}`} className="text-workshop-text hover:text-workshop-accent">
                  {customer.email}
                </a>
              </div>
            )}
            {!customer.phone && !customer.email && (
              <p className="text-sm text-workshop-muted">Ingen kontaktinfo</p>
            )}
          </div>
        </div>

        <div className="surface p-4 space-y-3">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Adress</h3>
          {customer.addressLine1 ? (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-workshop-muted flex-shrink-0 mt-0.5" />
              <div className="text-workshop-text">
                <p>{customer.addressLine1}</p>
                {customer.addressLine2 && <p>{customer.addressLine2}</p>}
                <p>{customer.postalCode} {customer.city}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-workshop-muted">Ingen adress registrerad</p>
          )}

          <div className="pt-2 border-t border-workshop-border space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-workshop-muted">Betalningsvillkor</span>
              <span className="text-workshop-text">{customer.defaultPaymentTermsDays} dagar</span>
            </div>
            {customer.vatExempt && (
              <div className="flex justify-between">
                <span className="text-workshop-muted">Momsbefriad</span>
                <span className="text-green-400">Ja</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="surface p-4">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-2">Anteckningar</h3>
          <p className="text-workshop-text text-sm whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}

      {/* ─── Fordon ─── */}
      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Fordon</h3>
          <span className="text-xs text-workshop-muted">{vehicles.length} st</span>
        </div>

        {vehicles.length > 0 ? (
          <div className="space-y-1">
            {vehicles.map((v) => (
              <Link
                key={v.id}
                href={`/vagnkort/${v.id}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-workshop-elevated transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Car className="h-4 w-4 text-workshop-muted" />
                  <span className="reg-plate text-sm">{v.regNr}</span>
                  <span className="text-sm text-workshop-text">
                    {v.brand} {v.model}
                    {v.modelYear ? ` (${v.modelYear})` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {v.mileageKm && (
                    <span className="text-xs text-workshop-muted">{v.mileageKm.toLocaleString("sv-SE")} km</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-workshop-muted group-hover:text-workshop-text" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-workshop-muted py-2">Inga fordon kopplade till denna kund</p>
        )}
      </div>

      {/* ─── Arbetsorder ─── */}
      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Arbetsorder</h3>
          <span className="text-xs text-workshop-muted">{workOrders.length} st</span>
        </div>

        {workOrders.length > 0 ? (
          <div className="space-y-1">
            {workOrders.slice(0, 10).map((wo) => (
              <Link
                key={wo.id}
                href={`/arbetsorder/${wo.id}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-workshop-elevated transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Wrench className="h-4 w-4 text-workshop-muted" />
                  <span className="text-sm text-workshop-text font-medium">{wo.orderNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[wo.status] ?? "bg-zinc-700 text-zinc-300"}`}>
                    {STATUS_LABELS[wo.status] ?? wo.status}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-workshop-muted group-hover:text-workshop-text" />
              </Link>
            ))}
            {workOrders.length > 10 && (
              <p className="text-xs text-workshop-muted text-center pt-2">
                + {workOrders.length - 10} fler arbetsorder
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-workshop-muted py-2">Inga arbetsorder</p>
        )}
      </div>

      {/* ─── Fakturor ─── */}
      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-workshop-muted uppercase tracking-wider">Fakturor</h3>
          <span className="text-xs text-workshop-muted">{invoices.length} st</span>
        </div>

        {invoices.length > 0 ? (
          <div className="space-y-1">
            {invoices.slice(0, 10).map((inv) => (
              <Link
                key={inv.id}
                href={`/faktura/${inv.id}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-workshop-elevated transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-workshop-muted" />
                  <span className="text-sm text-workshop-text font-medium">{inv.invoiceNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${INV_STATUS_COLORS[inv.status] ?? "bg-zinc-700 text-zinc-300"}`}>
                    {INV_STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {inv.totalInclVat && (
                    <span className="text-sm text-workshop-text font-medium">
                      {parseFloat(inv.totalInclVat).toLocaleString("sv-SE", { style: "currency", currency: "SEK" })}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-workshop-muted group-hover:text-workshop-text" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-workshop-muted py-2">Inga fakturor</p>
        )}
      </div>
    </div>
  );
}

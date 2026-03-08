import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { invoices, customers } from "@/lib/db/schemas";
import { eq, desc, and } from "drizzle-orm";
import { formatCurrency, formatDate } from "@/lib/utils";
import { INVOICE_STATUSES } from "@/lib/constants";

export const metadata = { title: "Faktura" };
export const dynamic = "force-dynamic";

export default async function FakturaPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string };
}) {
  const type   = searchParams.type   ?? "invoice";
  const status = searchParams.status;
  const isQuote = type === "quote";

  let data: any[] = [];
  try {
    const conditions: any[] = [eq(invoices.type, type as any)];
    if (status) conditions.push(eq(invoices.status, status as any));

    data = await db
      .select({
        id:            invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        type:          invoices.type,
        status:        invoices.status,
        invoiceDate:   invoices.invoiceDate,
        dueDate:       invoices.dueDate,
        totalIncVat:   invoices.totalIncVat,
        customerName:  customers.firstName,
        customerLast:  customers.lastName,
        customerCo:    customers.companyName,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(50);
  } catch (err) {
    console.error("[faktura] DB query failed:", err);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-workshop-text">
          {isQuote ? "Offerter" : "Fakturor"}
        </h1>
        <Link
          href={`/faktura/ny?type=${type}`}
          className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          {isQuote ? "Ny offert" : "Ny faktura"}
        </Link>
      </div>

      {/* Type tabs */}
      <div className="flex border-b border-workshop-border">
        {(["invoice", "quote"] as const).map((t) => (
          <Link
            key={t}
            href={`/faktura?type=${t}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              type === t
                ? "border-workshop-accent text-workshop-accent"
                : "border-transparent text-workshop-muted hover:text-workshop-text"
            }`}
          >
            {t === "invoice" ? "Fakturor" : "Offerter"}
          </Link>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(INVOICE_STATUSES).map(([key, cfg]) => (
          <Link
            key={key}
            href={`/faktura?type=${type}&status=${status === key ? "" : key}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              status === key ? cfg.color : "bg-workshop-elevated text-workshop-muted hover:text-workshop-text"
            }`}
          >
            {cfg.label}
          </Link>
        ))}
      </div>

      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-border bg-workshop-elevated">
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Nummer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Kund</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Datum</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Förfaller</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase">Belopp</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((inv) => {
              const statusCfg = INVOICE_STATUSES[inv.status as keyof typeof INVOICE_STATUSES];
              return (
                <tr key={inv.id} className="border-b border-workshop-border hover:bg-workshop-elevated/50 cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/faktura/${inv.id}`} className="font-mono text-sm hover:text-workshop-accent text-workshop-text font-medium">
                      {inv.invoiceNumber ?? "Utkast"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/faktura/${inv.id}`} className="text-workshop-text hover:text-workshop-accent">
                      {inv.customerCo ?? `${inv.customerName ?? ""} ${inv.customerLast ?? ""}`.trim()}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-workshop-muted hidden md:table-cell">
                    <Link href={`/faktura/${inv.id}`}>
                      {inv.invoiceDate ? formatDate(inv.invoiceDate) : "–"}
                    </Link>
                  </td>
                  <td className={`px-4 py-3 hidden md:table-cell ${inv.status === "overdue" ? "text-red-400" : "text-workshop-muted"}`}>
                    <Link href={`/faktura/${inv.id}`}>
                      {inv.dueDate ? formatDate(inv.dueDate) : "–"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-workshop-text">
                    <Link href={`/faktura/${inv.id}`}>
                      {formatCurrency(parseFloat(inv.totalIncVat))}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/faktura/${inv.id}`}>
                      <span className={`status-badge ${statusCfg?.color ?? ""}`}>
                        {statusCfg?.label ?? inv.status}
                      </span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {data.length === 0 && (
          <p className="text-center text-workshop-muted py-8 text-sm">
            Inga {isQuote ? "offerter" : "fakturor"} hittades
          </p>
        )}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { invoices, invoiceLines, customers } from "@/lib/db/schemas";
import { eq, asc } from "drizzle-orm";
import { formatCurrency, formatDate } from "@/lib/utils";
import { INVOICE_STATUSES, VALID_INVOICE_TRANSITIONS } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
import { InvoiceDetail } from "@/components/faktura/InvoiceDetail";
import { InvoiceLineEditor } from "@/components/faktura/InvoiceLineEditor";
import { NotesEditor } from "@/components/faktura/NotesEditor";
import { SwishQR } from "@/components/faktura/SwishQR";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: "Faktura" };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let invoice: any = null;
  let lines: any[] = [];

  try {
    const [result] = await db
      .select({
        id:               invoices.id,
        invoiceNumber:    invoices.invoiceNumber,
        type:             invoices.type,
        status:           invoices.status,
        customerId:       invoices.customerId,
        workOrderId:      invoices.workOrderId,
        invoiceDate:      invoices.invoiceDate,
        dueDate:          invoices.dueDate,
        subtotalExVat:    invoices.subtotalExVat,
        vatAmount:        invoices.vatAmount,
        vmbVatAmount:     invoices.vmbVatAmount,
        totalIncVat:      invoices.totalIncVat,
        paymentTermsDays: invoices.paymentTermsDays,
        notes:            invoices.notes,
        senderSnapshot:   invoices.senderSnapshot,
        createdAt:        invoices.createdAt,
        // Fortnox fields
        fortnoxId:         invoices.fortnoxId,
        fortnoxSyncStatus: invoices.fortnoxSyncStatus,
        fortnoxErrorMsg:   invoices.fortnoxErrorMsg,
        // Customer fields
        customerIsCompany:    customers.isCompany,
        customerFirstName:    customers.firstName,
        customerLastName:     customers.lastName,
        customerCompanyName:  customers.companyName,
        customerOrgNr:        customers.orgNr,
        customerPersonalNr:   customers.personalNr,
        customerEmail:        customers.email,
        customerPhone:        customers.phone,
        customerAddressLine1: customers.addressLine1,
        customerAddressLine2: customers.addressLine2,
        customerPostalCode:   customers.postalCode,
        customerCity:         customers.city,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(eq(invoices.id, params.id));

    invoice = result;

    if (invoice) {
      lines = await db
        .select()
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, params.id))
        .orderBy(asc(invoiceLines.sortOrder));
    }
  } catch (err) {
    console.error("[faktura/id] DB query failed:", err);
  }

  if (!invoice) notFound();

  const isQuote = invoice.type === "quote";
  const isDraft = invoice.status === "draft";
  const statusConfig = INVOICE_STATUSES[invoice.status as keyof typeof INVOICE_STATUSES]
    ?? { label: invoice.status, color: "bg-zinc-700 text-zinc-200" };
  const allowedTransitions = VALID_INVOICE_TRANSITIONS[invoice.status] ?? [];

  const customerName = invoice.customerIsCompany
    ? invoice.customerCompanyName
    : `${invoice.customerFirstName ?? ""} ${invoice.customerLastName ?? ""}`.trim();

  const customerIdNumber = invoice.customerIsCompany
    ? invoice.customerOrgNr
    : invoice.customerPersonalNr;

  const customerIdLabel = invoice.customerIsCompany ? "Org.nr" : "Personnr";

  const subtotalExVat = parseFloat(invoice.subtotalExVat);
  const vatAmount = parseFloat(invoice.vatAmount);
  const vmbVatAmount = parseFloat(invoice.vmbVatAmount);
  const totalIncVat = parseFloat(invoice.totalIncVat);

  // Workshop info from env or defaults
  const workshopName = process.env.WORKSHOP_NAME ?? "JM Trading";
  const workshopAddress = process.env.WORKSHOP_ADDRESS ?? "";
  const workshopPostalCode = process.env.WORKSHOP_POSTAL_CODE ?? "";
  const workshopCity = process.env.WORKSHOP_CITY ?? "";
  const workshopPhone = process.env.WORKSHOP_PHONE ?? "";
  const workshopEmail = process.env.WORKSHOP_EMAIL ?? "";
  const workshopOrgNr = process.env.WORKSHOP_ORG_NR ?? "";
  const workshopBankgiro = process.env.WORKSHOP_BANKGIRO ?? "";
  const workshopSwish = process.env.WORKSHOP_SWISH ?? "";

  // Prepare line data for the editor
  const editorLines = lines.map((l: any) => ({
    description: l.description ?? "",
    quantity: l.quantity ?? "1",
    unit: l.unit ?? "st",
    unitPrice: l.unitPrice ?? "0",
    discountPct: l.discountPct ?? "0",
    lineType: l.lineType ?? "labor",
    vmbEligible: l.vmbEligible ?? false,
    costBasis: l.costBasis ?? null,
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Action bar - hidden in print */}
      <div className="flex items-start justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link
            href="/faktura"
            className="p-2 rounded-md hover:bg-workshop-elevated text-workshop-muted hover:text-workshop-text"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-workshop-text">
                {isQuote ? "Offert" : "Faktura"} {invoice.invoiceNumber ?? "Utkast"}
              </h1>
              <span className={`status-badge ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3 no-print">
        <InvoiceDetail
          invoiceId={invoice.id}
          initialStatus={invoice.status}
          initialAllowedTransitions={allowedTransitions}
          fortnoxId={invoice.fortnoxId}
          fortnoxSyncStatus={invoice.fortnoxSyncStatus}
          fortnoxErrorMsg={invoice.fortnoxErrorMsg}
        />
        {!isQuote && workshopSwish && (
          <SwishQR
            invoiceId={invoice.id}
            totalIncVat={invoice.totalIncVat}
          />
        )}
      </div>

      {/* Edit lines button / editor (only for drafts) */}
      <InvoiceLineEditor
        invoiceId={invoice.id}
        isDraft={isDraft}
        initialLines={editorLines}
      />

      {/* ====================== PRINTABLE INVOICE ====================== */}
      <div className="invoice-printable surface p-6 md:p-8 space-y-6">
        {/* ---------- Header ---------- */}
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={workshopName}
              className="h-16 w-auto object-contain print-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
            <h2 className="text-2xl font-bold text-workshop-text print-text-black">
              {workshopName}
            </h2>
            {workshopAddress && (
              <p className="text-sm text-workshop-muted print-text-gray">
                {workshopAddress}
              </p>
            )}
            {(workshopPostalCode || workshopCity) && (
              <p className="text-sm text-workshop-muted print-text-gray">
                {workshopPostalCode} {workshopCity}
              </p>
            )}
            {workshopPhone && (
              <p className="text-sm text-workshop-muted print-text-gray">
                Tel: {workshopPhone}
              </p>
            )}
            {workshopEmail && (
              <p className="text-sm text-workshop-muted print-text-gray">
                {workshopEmail}
              </p>
            )}
            {workshopOrgNr && (
              <p className="text-sm text-workshop-muted print-text-gray">
                Org.nr: {workshopOrgNr}
              </p>
            )}
          </div>
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold uppercase text-workshop-text print-text-black">
              {isQuote ? "OFFERT" : "FAKTURA"}
            </h3>
            <p className="text-sm text-workshop-muted print-text-gray mt-1">
              Status:{" "}
              <span className={`status-badge ${statusConfig.color} print-status-badge`}>
                {statusConfig.label}
              </span>
            </p>
          </div>
        </div>

        {/* ---------- Invoice meta + Customer info ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Invoice details */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider print-text-gray">
              {isQuote ? "Offertuppgifter" : "Fakturauppgifter"}
            </h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-workshop-muted print-text-gray">Nummer:</span>
                <span className="text-workshop-text font-mono print-text-black">
                  {invoice.invoiceNumber ?? "Ej tilldelat"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-workshop-muted print-text-gray">
                  {isQuote ? "Offertdatum:" : "Fakturadatum:"}
                </span>
                <span className="text-workshop-text print-text-black">
                  {formatDate(invoice.invoiceDate)}
                </span>
              </div>
              {!isQuote && (
                <div className="flex justify-between">
                  <span className="text-workshop-muted print-text-gray">Förfallodatum:</span>
                  <span className="text-workshop-text print-text-black">
                    {formatDate(invoice.dueDate)}
                  </span>
                </div>
              )}
              {!isQuote && (
                <div className="flex justify-between">
                  <span className="text-workshop-muted print-text-gray">Betalningsvillkor:</span>
                  <span className="text-workshop-text print-text-black">
                    {invoice.paymentTermsDays} dagar netto
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Customer info */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider print-text-gray">
              Kund
            </h4>
            <div className="text-sm space-y-1">
              <p className="font-medium text-workshop-text print-text-black">
                {customerName}
              </p>
              {invoice.customerAddressLine1 && (
                <p className="text-workshop-muted print-text-gray">
                  {invoice.customerAddressLine1}
                </p>
              )}
              {invoice.customerAddressLine2 && (
                <p className="text-workshop-muted print-text-gray">
                  {invoice.customerAddressLine2}
                </p>
              )}
              {(invoice.customerPostalCode || invoice.customerCity) && (
                <p className="text-workshop-muted print-text-gray">
                  {invoice.customerPostalCode} {invoice.customerCity}
                </p>
              )}
              {customerIdNumber && (
                <p className="text-workshop-muted print-text-gray">
                  {customerIdLabel}: {customerIdNumber}
                </p>
              )}
              {invoice.customerPhone && (
                <p className="text-workshop-muted print-text-gray">
                  Tel: {invoice.customerPhone}
                </p>
              )}
              {invoice.customerEmail && (
                <p className="text-workshop-muted print-text-gray">
                  {invoice.customerEmail}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---------- Line items table ---------- */}
        <div>
          <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-2 print-text-gray">
            Rader
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-workshop-border print-border-gray">
                  <th className="py-2 pr-3 text-left text-xs font-medium text-workshop-muted uppercase print-text-gray">
                    Beskrivning
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-workshop-muted uppercase print-text-gray">
                    Antal
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-workshop-muted uppercase print-text-gray">
                    Enhet
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-workshop-muted uppercase print-text-gray">
                    Pris
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-workshop-muted uppercase print-text-gray">
                    Rabatt
                  </th>
                  <th className="py-2 pl-3 text-right text-xs font-medium text-workshop-muted uppercase print-text-gray">
                    Belopp
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any) => {
                  const qty = parseFloat(line.quantity);
                  const unitPrice = parseFloat(line.unitPrice);
                  const discount = parseFloat(line.discountPct);
                  const lineTotal = line.lineTotal ? parseFloat(line.lineTotal) : qty * unitPrice * (1 - discount / 100);
                  const unitLabel = line.unit === "pcs" ? "st" : line.unit;

                  return (
                    <tr
                      key={line.id}
                      className="border-b border-workshop-border/50 print-border-gray-light"
                    >
                      <td className="py-2.5 pr-3 text-workshop-text print-text-black">
                        {line.description}
                        {line.vmbEligible && (
                          <span className="ml-2 text-xs text-workshop-muted print-text-gray">(VMB)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-workshop-text print-text-black">
                        {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-workshop-muted print-text-gray">
                        {unitLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-workshop-text print-text-black">
                        {formatCurrency(unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-workshop-muted print-text-gray">
                        {discount > 0 ? `${discount}%` : ""}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono font-medium text-workshop-text print-text-black">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-workshop-muted print-text-gray">
                      Inga rader {isDraft && "- klicka \"Redigera rader\" ovan"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- Summary ---------- */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-workshop-muted print-text-gray">Summa exkl. moms</span>
              <span className="font-mono text-workshop-text print-text-black">
                {formatCurrency(subtotalExVat)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-workshop-muted print-text-gray">Moms 25%</span>
              <span className="font-mono text-workshop-text print-text-black">
                {formatCurrency(vatAmount)}
              </span>
            </div>
            {vmbVatAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-workshop-muted print-text-gray">
                  VMB-moms (vinstmarginal)
                </span>
                <span className="font-mono text-workshop-text print-text-black">
                  {formatCurrency(vmbVatAmount)}
                </span>
              </div>
            )}
            <div className="border-t border-workshop-border pt-2 mt-2 flex justify-between print-border-gray">
              <span className="font-bold text-workshop-text print-text-black">
                Totalt inkl. moms
              </span>
              <span className="font-bold font-mono text-workshop-accent print-text-black text-lg">
                {formatCurrency(totalIncVat)}
              </span>
            </div>
          </div>
        </div>

        {/* ---------- Payment Information ---------- */}
        {!isQuote && (
          <div className="border-t border-workshop-border pt-4 print-border-gray">
            <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-3 print-text-gray">
              Betalningsinformation
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {workshopBankgiro && (
                <div className="bg-workshop-bg/50 rounded-md p-3 print-bg-white">
                  <span className="block text-xs text-workshop-muted print-text-gray mb-0.5">
                    Bankgiro
                  </span>
                  <span className="font-mono font-bold text-workshop-text print-text-black text-base">
                    {workshopBankgiro}
                  </span>
                </div>
              )}
              {workshopSwish && (
                <div className="bg-workshop-bg/50 rounded-md p-3 print-bg-white">
                  <span className="block text-xs text-workshop-muted print-text-gray mb-0.5">
                    Swish
                  </span>
                  <span className="font-mono font-bold text-workshop-text print-text-black text-base">
                    {workshopSwish}
                  </span>
                </div>
              )}
              <div className="bg-workshop-bg/50 rounded-md p-3 print-bg-white">
                <span className="block text-xs text-workshop-muted print-text-gray mb-0.5">
                  OCR / Referens
                </span>
                <span className="font-mono font-bold text-workshop-text print-text-black text-base">
                  {invoice.invoiceNumber ?? "–"}
                </span>
              </div>
              <div className="bg-workshop-bg/50 rounded-md p-3 print-bg-white">
                <span className="block text-xs text-workshop-muted print-text-gray mb-0.5">
                  Att betala
                </span>
                <span className="font-mono font-bold text-workshop-accent print-text-black text-base">
                  {formatCurrency(totalIncVat)}
                </span>
              </div>
              <div className="bg-workshop-bg/50 rounded-md p-3 print-bg-white">
                <span className="block text-xs text-workshop-muted print-text-gray mb-0.5">
                  Förfallodatum
                </span>
                <span className="font-bold text-workshop-text print-text-black text-base">
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
              {workshopOrgNr && (
                <div className="bg-workshop-bg/50 rounded-md p-3 print-bg-white">
                  <span className="block text-xs text-workshop-muted print-text-gray mb-0.5">
                    Org.nr
                  </span>
                  <span className="font-mono text-workshop-text print-text-black text-base">
                    {workshopOrgNr}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- Notes ---------- */}
        <div className="border-t border-workshop-border pt-4 print-border-gray">
          <h4 className="text-xs font-medium text-workshop-muted uppercase tracking-wider mb-1 print-text-gray">
            Anteckningar
          </h4>
          {invoice.notes ? (
            <p className="text-sm text-workshop-text whitespace-pre-wrap print-text-black">
              {invoice.notes}
            </p>
          ) : (
            <p className="text-sm text-workshop-muted print-text-gray">
              Inga anteckningar
            </p>
          )}
          <NotesEditor
            invoiceId={invoice.id}
            isDraft={isDraft}
            initialNotes={invoice.notes ?? ""}
          />
        </div>

        {/* ---------- Footer (print only) ---------- */}
        <div className="hidden print-block border-t border-gray-300 pt-4 mt-8 text-center text-xs text-gray-500">
          <p>
            {workshopName}
            {workshopOrgNr ? ` | Org.nr: ${workshopOrgNr}` : ""}
            {workshopBankgiro ? ` | Bankgiro: ${workshopBankgiro}` : ""}
            {workshopSwish ? ` | Swish: ${workshopSwish}` : ""}
          </p>
          {workshopAddress && (
            <p>{workshopAddress}, {workshopPostalCode} {workshopCity}</p>
          )}
          {(workshopPhone || workshopEmail) && (
            <p>
              {workshopPhone ? `Tel: ${workshopPhone}` : ""}
              {workshopPhone && workshopEmail ? " | " : ""}
              {workshopEmail ?? ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

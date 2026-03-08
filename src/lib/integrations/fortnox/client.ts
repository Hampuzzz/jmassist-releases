import type {
  FortnoxCustomer,
  FortnoxCustomerResponse,
  FortnoxInvoice,
  FortnoxInvoiceResponse,
  FortnoxInvoiceRow,
  FortnoxErrorResponse,
} from "./types";
import { FORTNOX_ACCOUNTS, FORTNOX_VAT_CODES } from "./types";

// ─── Configuration ─────────────────────────────────────────────────────────

const BASE_URL = process.env.FORTNOX_BASE_URL || "https://api.fortnox.se/3";
const ACCESS_TOKEN = process.env.FORTNOX_ACCESS_TOKEN || "";

export function isFortnoxEnabled(): boolean {
  return ACCESS_TOKEN.length > 0;
}

// ─── Rate Limiter (25 req / 5s) ────────────────────────────────────────────

const requestTimestamps: number[] = [];

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  // Remove timestamps older than 5 seconds
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 5000) {
    requestTimestamps.shift();
  }
  // Wait if we've hit 25 requests in the window
  if (requestTimestamps.length >= 25) {
    const waitMs = 5000 - (now - requestTimestamps[0]);
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs + 100));
  }
  requestTimestamps.push(Date.now());

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      ...options.headers,
    },
  });

  // Handle rate limit (429)
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 5000));
    return rateLimitedFetch(url, options);
  }

  return res;
}

// ─── Mock Mode ─────────────────────────────────────────────────────────────

function mockLog(action: string, data: unknown) {
  console.log(`[fortnox:mock] ${action}:`, JSON.stringify(data, null, 2));
}

// ─── Customer API ──────────────────────────────────────────────────────────

export interface LocalCustomer {
  id: string;
  isCompany: boolean;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  orgNr: string | null;
  personalNr: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  fortnoxCustomerNumber: string | null;
}

function mapCustomerToFortnox(c: LocalCustomer): FortnoxCustomer {
  return {
    Name: c.isCompany
      ? c.companyName ?? "Okänt företag"
      : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Okänd kund",
    OrganisationNumber: c.orgNr ?? c.personalNr ?? undefined,
    Address1: c.addressLine1 ?? undefined,
    Address2: c.addressLine2 ?? undefined,
    ZipCode: c.postalCode ?? undefined,
    City: c.city ?? undefined,
    CountryCode: "SE",
    Email: c.email ?? undefined,
    Phone1: c.phone ?? undefined,
    Type: c.isCompany ? "COMPANY" : "PRIVATE",
    Currency: "SEK",
  };
}

/**
 * Get or create a Fortnox customer. If fortnoxCustomerNumber is already set,
 * update the existing customer. Otherwise, create a new one.
 */
export async function getOrCreateFortnoxCustomer(
  customer: LocalCustomer,
): Promise<{ customerNumber: string; created: boolean }> {
  const fortnoxData = mapCustomerToFortnox(customer);

  if (!isFortnoxEnabled()) {
    const mockNumber = `MOCK-${customer.id.slice(0, 8)}`;
    mockLog("getOrCreateCustomer", { ...fortnoxData, CustomerNumber: mockNumber });
    return { customerNumber: mockNumber, created: true };
  }

  // If already linked, update
  if (customer.fortnoxCustomerNumber) {
    const res = await rateLimitedFetch(
      `${BASE_URL}/customers/${customer.fortnoxCustomerNumber}`,
      {
        method: "PUT",
        body: JSON.stringify({ Customer: fortnoxData }),
      },
    );

    if (res.ok) {
      const data = (await res.json()) as FortnoxCustomerResponse;
      return { customerNumber: data.Customer.CustomerNumber, created: false };
    }
    // If 404, customer was deleted in Fortnox — create new
    if (res.status !== 404) {
      const err = (await res.json()) as FortnoxErrorResponse;
      throw new Error(err.ErrorInformation?.Message ?? `Fortnox API ${res.status}`);
    }
  }

  // Create new customer
  const res = await rateLimitedFetch(`${BASE_URL}/customers`, {
    method: "POST",
    body: JSON.stringify({ Customer: fortnoxData }),
  });

  if (!res.ok) {
    const err = (await res.json()) as FortnoxErrorResponse;
    throw new Error(err.ErrorInformation?.Message ?? `Fortnox API ${res.status}`);
  }

  const data = (await res.json()) as FortnoxCustomerResponse;
  return { customerNumber: data.Customer.CustomerNumber, created: true };
}

// ─── Invoice API ───────────────────────────────────────────────────────────

export interface LocalInvoiceLine {
  lineType: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPct: string;
  vmbEligible: boolean;
  costBasis: string | null;
}

export interface LocalInvoice {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  notes: string | null;
  totalIncVat: string;
}

function mapLineToFortnox(line: LocalInvoiceLine): FortnoxInvoiceRow {
  const qty = parseFloat(line.quantity) || 1;
  const price = parseFloat(line.unitPrice) || 0;
  const discPct = parseFloat(line.discountPct) || 0;

  const base: FortnoxInvoiceRow = {
    Description: line.description,
    DeliveredQuantity: qty.toString(),
    Price: price,
    Unit: line.unit === "tim" ? "tim" : line.unit === "st" ? "st" : line.unit,
  };

  if (discPct > 0) {
    base.Discount = discPct;
    base.DiscountType = "PERCENT";
  }

  if (line.vmbEligible) {
    // VMB: use margin scheme account + VAT code
    base.AccountNumber = FORTNOX_ACCOUNTS.SALES_VMB;
    base.VATCode = FORTNOX_VAT_CODES.VMB_25;
  } else if (line.lineType === "labor" || line.lineType === "fee") {
    base.AccountNumber = FORTNOX_ACCOUNTS.SALES_SERVICE_25;
    base.VAT = 25;
  } else {
    // Parts, goods
    base.AccountNumber = FORTNOX_ACCOUNTS.SALES_GOODS_25;
    base.VAT = 25;
  }

  return base;
}

/**
 * Create a draft invoice in Fortnox.
 * Returns the Fortnox document number.
 */
export async function createFortnoxInvoice(
  invoice: LocalInvoice,
  lines: LocalInvoiceLine[],
  fortnoxCustomerNumber: string,
): Promise<{ documentNumber: string; total: number }> {
  const fortnoxInvoice: FortnoxInvoice = {
    CustomerNumber: fortnoxCustomerNumber,
    InvoiceDate: invoice.invoiceDate ?? undefined,
    DueDate: invoice.dueDate ?? undefined,
    Remarks: invoice.notes ?? undefined,
    OurReference: invoice.invoiceNumber ?? undefined,
    Currency: "SEK",
    InvoiceRows: lines.map(mapLineToFortnox),
  };

  if (!isFortnoxEnabled()) {
    const mockDocNr = `FNX-MOCK-${Date.now()}`;
    mockLog("createInvoice", fortnoxInvoice);
    return { documentNumber: mockDocNr, total: parseFloat(invoice.totalIncVat) || 0 };
  }

  const res = await rateLimitedFetch(`${BASE_URL}/invoices`, {
    method: "POST",
    body: JSON.stringify({ Invoice: fortnoxInvoice }),
  });

  if (!res.ok) {
    const err = (await res.json()) as FortnoxErrorResponse;
    throw new Error(err.ErrorInformation?.Message ?? `Fortnox API ${res.status}`);
  }

  const data = (await res.json()) as FortnoxInvoiceResponse;
  return {
    documentNumber: data.Invoice.DocumentNumber,
    total: data.Invoice.Total,
  };
}

/**
 * Fetch an existing invoice from Fortnox.
 */
export async function getFortnoxInvoice(
  documentNumber: string,
): Promise<FortnoxInvoiceResponse | null> {
  if (!isFortnoxEnabled()) {
    mockLog("getInvoice", { documentNumber });
    return null;
  }

  const res = await rateLimitedFetch(`${BASE_URL}/invoices/${documentNumber}`, {
    method: "GET",
  });

  if (!res.ok) return null;
  return (await res.json()) as FortnoxInvoiceResponse;
}

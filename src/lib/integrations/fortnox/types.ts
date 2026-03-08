// ─── Fortnox API Types ─────────────────────────────────────────────────────

export interface FortnoxCustomer {
  CustomerNumber?: string;
  Name: string;
  OrganisationNumber?: string;
  Address1?: string;
  Address2?: string;
  ZipCode?: string;
  City?: string;
  CountryCode?: string;
  Email?: string;
  Phone1?: string;
  Phone2?: string;
  Type?: "PRIVATE" | "COMPANY";
  Active?: boolean;
  Currency?: string;
  DefaultDeliveryTypes?: { Invoice?: string; Order?: string; Offer?: string };
}

export interface FortnoxInvoiceRow {
  AccountNumber?: number;
  ArticleNumber?: string;
  Description: string;
  DeliveredQuantity: string;
  Price: number;
  PriceExcludingVAT?: number;
  Discount?: number;
  DiscountType?: "AMOUNT" | "PERCENT";
  VAT?: number;
  VATCode?: string;
  Unit?: string;
}

export interface FortnoxInvoice {
  CustomerNumber: string;
  InvoiceDate?: string;
  DueDate?: string;
  YourReference?: string;
  OurReference?: string;
  Remarks?: string;
  Currency?: string;
  VATIncluded?: boolean;
  InvoiceRows: FortnoxInvoiceRow[];
}

export interface FortnoxInvoiceResponse {
  Invoice: {
    DocumentNumber: string;
    CustomerNumber: string;
    Total: number;
    TotalVAT: number;
    InvoiceRows: FortnoxInvoiceRow[];
    [key: string]: unknown;
  };
}

export interface FortnoxCustomerResponse {
  Customer: FortnoxCustomer & {
    CustomerNumber: string;
    [key: string]: unknown;
  };
}

export interface FortnoxErrorResponse {
  ErrorInformation?: {
    Error: number;
    Message: string;
    Code: number;
  };
}

// BAS account numbers for Swedish bookkeeping
export const FORTNOX_ACCOUNTS = {
  SALES_SERVICE_25:  3001,  // Försäljning tjänster 25% moms
  SALES_GOODS_25:    3011,  // Försäljning varor 25% moms
  SALES_VMB:         3210,  // Försäljning VMB (marginalvaror)
} as const;

// Fortnox VAT codes
export const FORTNOX_VAT_CODES = {
  STANDARD_25: undefined,   // Default 25% on account 3001/3011
  VMB_25:      "MP1",       // Vinstmarginalbeskattning 25%
  VMB_12:      "MP2",       // Vinstmarginalbeskattning 12%
  VMB_6:       "MP3",       // Vinstmarginalbeskattning 6%
  EXEMPT:      "0",         // No VAT
} as const;

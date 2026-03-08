import { VAT_RATE, VMB_FACTOR } from "@/lib/constants";

export function calcStandardVat(lineTotal: number, vatRate = VAT_RATE): number {
  return lineTotal * vatRate;
}

/**
 * VMB (Vinstmarginalbeskattning) calculation.
 * Tax = (sellPrice - costBasis) * quantity * 0.20
 * The tax is already embedded in the sell price (not added on top).
 */
export function calcVmbTax(
  sellPrice: number,
  costBasis: number,
  quantity: number,
): number {
  const margin = sellPrice - costBasis;
  if (margin <= 0) return 0;
  return margin * quantity * VMB_FACTOR;
}

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  discountPct: number;
  vatRatePct: number;
  vmbEligible: boolean;
  costBasis?: number | null;
}

export interface InvoiceVatSummary {
  standardSubtotalExVat: number;
  standardVatAmount: number;
  vmbSubtotalExVat: number;
  vmbTaxAmount: number;
  totalExVat: number;
  totalVatAndTax: number;
  totalIncVat: number;
}

export function computeInvoiceVatSummary(lines: LineItemInput[]): InvoiceVatSummary {
  let standardSubtotalExVat = 0;
  let standardVatAmount = 0;
  let vmbSubtotalExVat = 0;
  let vmbTaxAmount = 0;

  for (const line of lines) {
    const lineTotal = line.quantity * line.unitPrice * (1 - line.discountPct / 100);

    if (line.vmbEligible && line.costBasis != null) {
      vmbSubtotalExVat += lineTotal;
      vmbTaxAmount += calcVmbTax(line.unitPrice, line.costBasis, line.quantity);
    } else {
      standardSubtotalExVat += lineTotal;
      standardVatAmount += lineTotal * (line.vatRatePct / 100);
    }
  }

  const totalExVat = standardSubtotalExVat + vmbSubtotalExVat;
  const totalVatAndTax = standardVatAmount + vmbTaxAmount;

  return {
    standardSubtotalExVat,
    standardVatAmount,
    vmbSubtotalExVat,
    vmbTaxAmount,
    totalExVat,
    totalVatAndTax,
    totalIncVat: totalExVat + totalVatAndTax,
  };
}

export function calcMarkupPct(costPrice: number, sellPrice: number): number {
  if (costPrice <= 0) return 0;
  return ((sellPrice - costPrice) / costPrice) * 100;
}

export function calcSellPriceFromMarkup(costPrice: number, markupPct: number): number {
  return costPrice * (1 + markupPct / 100);
}

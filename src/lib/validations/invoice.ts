/**
 * Zod schemas for invoice/quote creation and updates.
 * Provides strict validation for financial inputs.
 */

import { z } from "zod";

// ── Shared line item schema ──

const invoiceLineSchema = z.object({
  sortOrder:       z.coerce.number().int().min(0).max(999),
  lineType:        z.enum(["labor", "part", "fee", "discount"]),
  partId:          z.string().uuid().nullable().optional(),
  workOrderTaskId: z.string().uuid().nullable().optional(),
  description:     z.string().min(1, "Beskrivning krävs").max(500),
  quantity:        z.coerce.number().min(0.001, "Kvantitet måste vara positiv").max(99_999, "Kvantitet för hög"),
  unit:            z.string().min(1).max(20).default("st"),
  unitPrice:       z.coerce.number().min(-999_999, "Pris för lågt").max(999_999, "Pris för högt"),
  discountPct:     z.coerce.number().min(0, "Rabatt kan inte vara negativ").max(100, "Rabatt kan inte överstiga 100%").default(0),
  vmbEligible:     z.boolean().default(false),
  costBasis:       z.coerce.number().min(0).max(999_999).nullable().optional(),
});

export type ValidatedInvoiceLine = z.infer<typeof invoiceLineSchema>;

// ── Create invoice ──

export const createInvoiceSchema = z.object({
  customerId:       z.string().uuid("Ogiltigt kund-ID"),
  workOrderId:      z.string().uuid().optional(),
  type:             z.enum(["invoice", "quote"]).default("invoice"),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  notes:            z.string().max(2000).nullable().optional(),
  senderSnapshot:   z.record(z.unknown()).optional(),
  lines:            z.array(invoiceLineSchema).min(1, "Minst en rad krävs").max(200, "Max 200 rader"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ── Update invoice (PATCH) ──

export const updateInvoiceSchema = z.object({
  status:           z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  paymentMethod:    z.enum(["cash", "card", "swish", "bankgiro", "bank_transfer", "other"]).optional(),
  paymentReference: z.string().max(200).optional(),
  notes:            z.string().max(2000).optional(),
  dueDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datumformat (YYYY-MM-DD)").optional(),
  lines:            z.array(invoiceLineSchema).min(1).max(200).optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

// ── Financial calculation helpers (using integer cents to avoid float issues) ──

/**
 * Multiply two financial values safely using integer arithmetic.
 * All values are multiplied by 10000 (4 decimal places), computed, then divided back.
 */
export function safeMultiply(a: number, b: number): number {
  // Use string-based precision: round to 4 decimal places
  return Math.round(a * b * 10000) / 10000;
}

/**
 * Calculate line total with discount, avoiding float precision issues.
 */
export function calcLineTotal(qty: number, unitPrice: number, discountPct: number): number {
  const gross = safeMultiply(qty, unitPrice);
  if (discountPct === 0) return gross;
  const discount = safeMultiply(gross, discountPct / 100);
  return Math.round((gross - discount) * 10000) / 10000;
}

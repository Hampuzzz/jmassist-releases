import {
  pgTable, pgEnum, uuid, text, boolean, timestamp, date, integer, numeric, jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";
import { userProfiles } from "./users";
import { parts } from "./parts";
import { workOrderTasks } from "./work-orders";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", "sent", "paid", "overdue", "cancelled",
]);
export const invoiceTypeEnum = pgEnum("invoice_type", ["quote", "invoice"]);
export const invoiceLineTypeEnum = pgEnum("invoice_line_type", [
  "labor", "part", "fee", "discount",
]);

export const invoices = pgTable("invoices", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  invoiceNumber:        text("invoice_number").unique(),
  type:                 invoiceTypeEnum("type").notNull().default("invoice"),
  status:               invoiceStatusEnum("status").notNull().default("draft"),
  customerId:           uuid("customer_id").notNull().references(() => customers.id),
  workOrderId:          uuid("work_order_id"),
  convertedFromQuoteId: uuid("converted_from_quote_id"),
  invoiceDate:          date("invoice_date"),
  dueDate:              date("due_date"),
  subtotalExVat:        numeric("subtotal_ex_vat", { precision: 14, scale: 4 }).notNull().default("0"),
  vatAmount:            numeric("vat_amount", { precision: 14, scale: 4 }).notNull().default("0"),
  vmbVatAmount:         numeric("vmb_vat_amount", { precision: 14, scale: 4 }).notNull().default("0"),
  totalIncVat:          numeric("total_inc_vat", { precision: 14, scale: 4 }).notNull().default("0"),
  paymentTermsDays:     integer("payment_terms_days").notNull().default(30),
  paidAt:               timestamp("paid_at", { withTimezone: true }),
  paymentMethod:        text("payment_method"),
  paymentReference:     text("payment_reference"),
  senderSnapshot:       jsonb("sender_snapshot"),
  notes:                text("notes"),
  // Fortnox integration
  fortnoxId:            text("fortnox_id"),
  fortnoxSyncStatus:    text("fortnox_sync_status").notNull().default("not_synced"),
  fortnoxSyncedAt:      timestamp("fortnox_synced_at", { withTimezone: true }),
  fortnoxErrorMsg:      text("fortnox_error_msg"),
  createdBy:            uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLines = pgTable("invoice_lines", {
  id:               uuid("id").primaryKey().defaultRandom(),
  invoiceId:        uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  sortOrder:        integer("sort_order").notNull().default(0),
  lineType:         invoiceLineTypeEnum("line_type").notNull(),
  partId:           uuid("part_id").references(() => parts.id, { onDelete: "set null" }),
  workOrderTaskId:  uuid("work_order_task_id").references(() => workOrderTasks.id, { onDelete: "set null" }),
  description:      text("description").notNull(),
  quantity:         numeric("quantity", { precision: 12, scale: 4 }).notNull().default("1"),
  unit:             text("unit").notNull().default("pcs"),
  unitPrice:        numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
  discountPct:      numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  // DB-generated columns (read-only)
  lineTotal:        numeric("line_total", { precision: 14, scale: 4 }),
  vatRatePct:       numeric("vat_rate_pct", { precision: 5, scale: 2 }).notNull().default("25.00"),
  vatAmount:        numeric("vat_amount", { precision: 14, scale: 4 }),
  vmbEligible:      boolean("vmb_eligible").notNull().default(false),
  costBasis:        numeric("cost_basis", { precision: 12, scale: 4 }),
  vmbVatAmount:     numeric("vmb_vat_amount", { precision: 14, scale: 4 }),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  lines:    many(invoiceLines),
}));

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;

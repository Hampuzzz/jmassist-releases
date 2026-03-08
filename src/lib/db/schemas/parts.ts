import { pgTable, pgEnum, uuid, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { suppliers } from "./suppliers";

export const stockMovementReasonEnum = pgEnum("stock_movement_reason", [
  "work_order_use", "manual_adjustment", "supplier_delivery",
  "return_to_supplier", "write_off", "initial_stock",
]);

export const parts = pgTable("parts", {
  id:             uuid("id").primaryKey().defaultRandom(),
  supplierId:     uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  partNumber:     text("part_number").notNull(),
  internalNumber: text("internal_number"),
  name:           text("name").notNull(),
  description:    text("description"),
  category:       text("category"),
  unit:           text("unit").notNull().default("pcs"),
  costPrice:      numeric("cost_price", { precision: 12, scale: 4 }).notNull().default("0"),
  sellPrice:      numeric("sell_price", { precision: 12, scale: 4 }).notNull().default("0"),
  // markupPct is a DB-generated column - read only
  markupPct:      numeric("markup_pct", { precision: 8, scale: 4 }),
  vatRatePct:     numeric("vat_rate_pct", { precision: 5, scale: 2 }).notNull().default("25.00"),
  vmbEligible:    boolean("vmb_eligible").notNull().default(false),
  stockQty:       numeric("stock_qty", { precision: 12, scale: 4 }).notNull().default("0"),
  stockMinQty:    numeric("stock_min_qty", { precision: 12, scale: 4 }).notNull().default("0"),
  stockLocation:  text("stock_location"),
  isActive:       boolean("is_active").notNull().default(true),
  notes:          text("notes"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id:           uuid("id").primaryKey().defaultRandom(),
  partId:       uuid("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  workOrderId:  uuid("work_order_id"),
  userId:       uuid("user_id"),
  reason:       stockMovementReasonEnum("reason").notNull(),
  qtyChange:    numeric("qty_change", { precision: 12, scale: 4 }).notNull(),
  qtyBefore:    numeric("qty_before", { precision: 12, scale: 4 }).notNull(),
  qtyAfter:     numeric("qty_after", { precision: 12, scale: 4 }).notNull(),
  unitCost:     numeric("unit_cost", { precision: 12, scale: 4 }),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partsRelations = relations(parts, ({ one, many }) => ({
  supplier:       one(suppliers, { fields: [parts.supplierId], references: [suppliers.id] }),
  stockMovements: many(stockMovements),
}));

export type Part = typeof parts.$inferSelect;
export type NewPart = typeof parts.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;

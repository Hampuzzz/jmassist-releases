import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { suppliers } from "./suppliers";
import { workOrders } from "./work-orders";
import { parts } from "./parts";
import { userProfiles } from "./users";

// ─── Purchase Orders ────────────────────────────────────────────────────────

export const purchaseOrders = pgTable("purchase_orders", {
  id:          uuid("id").primaryKey().defaultRandom(),
  supplierId:  uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  status:      text("status").notNull().default("delivered"),
  reference:   text("reference"),
  notes:       text("notes"),
  orderedAt:   timestamp("ordered_at", { withTimezone: true }).defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).defaultNow(),
  createdBy:   uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id:              uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id").notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  partId:          uuid("part_id").references(() => parts.id, { onDelete: "set null" }),
  partNumberRaw:   text("part_number_raw").notNull(),
  partNameRaw:     text("part_name_raw").notNull(),
  quantity:        numeric("quantity", { precision: 12, scale: 4 }).notNull(),
  unitCostPrice:   numeric("unit_cost_price", { precision: 12, scale: 4 }).notNull(),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ──────────────────────────────────────────────────────────────

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier:  one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  workOrder: one(workOrders, { fields: [purchaseOrders.workOrderId], references: [workOrders.id] }),
  creator:   one(userProfiles, { fields: [purchaseOrders.createdBy], references: [userProfiles.id] }),
  lines:     many(purchaseOrderLines),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderLines.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  part: one(parts, { fields: [purchaseOrderLines.partId], references: [parts.id] }),
}));

// ─── Types ──────────────────────────────────────────────────────────────────

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;

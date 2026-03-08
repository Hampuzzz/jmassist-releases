import { pgTable, uuid, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { workOrders } from "./work-orders";
import { vehicles } from "./vehicles";
import { userProfiles } from "./users";

// ── Vehicle Health Check (protocol) ──────────────────────────

export const vehicleHealthChecks = pgTable("vehicle_health_checks", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  workOrderId:        uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  vehicleId:          uuid("vehicle_id").notNull().references(() => vehicles.id),
  mechanicId:         uuid("mechanic_id").references(() => userProfiles.id),
  publicToken:        text("public_token").notNull().unique(),
  status:             text("status").notNull().default("draft"), // draft | sent | approved | expired
  customerNotifiedAt: timestamp("customer_notified_at", { withTimezone: true }),
  customerApprovedAt: timestamp("customer_approved_at", { withTimezone: true }),
  notes:              text("notes"),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── VHC Items (traffic-light checklist) ──────────────────────

export const vhcItems = pgTable("vhc_items", {
  id:               uuid("id").primaryKey().defaultRandom(),
  checkId:          uuid("check_id").notNull().references(() => vehicleHealthChecks.id, { onDelete: "cascade" }),
  category:         text("category").notNull(),
  label:            text("label").notNull(),
  severity:         text("severity").notNull().default("green"), // green | yellow | red
  comment:          text("comment"),
  estimatedCost:    numeric("estimated_cost", { precision: 10, scale: 2 }),
  customerApproved: boolean("customer_approved").default(false),
  mediaUrls:        text("media_urls").array(),
  sortOrder:        integer("sort_order").notNull().default(0),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────

export const vehicleHealthChecksRelations = relations(vehicleHealthChecks, ({ one, many }) => ({
  workOrder: one(workOrders, { fields: [vehicleHealthChecks.workOrderId], references: [workOrders.id] }),
  vehicle:   one(vehicles, { fields: [vehicleHealthChecks.vehicleId], references: [vehicles.id] }),
  mechanic:  one(userProfiles, { fields: [vehicleHealthChecks.mechanicId], references: [userProfiles.id] }),
  items:     many(vhcItems),
}));

export const vhcItemsRelations = relations(vhcItems, ({ one }) => ({
  check: one(vehicleHealthChecks, { fields: [vhcItems.checkId], references: [vehicleHealthChecks.id] }),
}));

// ── Types ────────────────────────────────────────────────────

export type VehicleHealthCheck = typeof vehicleHealthChecks.$inferSelect;
export type NewVehicleHealthCheck = typeof vehicleHealthChecks.$inferInsert;
export type VhcItem = typeof vhcItems.$inferSelect;
export type NewVhcItem = typeof vhcItems.$inferInsert;

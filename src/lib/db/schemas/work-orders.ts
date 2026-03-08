import {
  pgTable, pgEnum, uuid, text, boolean, timestamp, integer, numeric, primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";
import { vehicles } from "./vehicles";
import { userProfiles } from "./users";
import { parts } from "./parts";
import { inspectionTemplates } from "./inspections";

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "queued", "diagnosing", "ongoing", "ordering_parts", "waiting_for_parts",
  "ready_for_pickup", "finished", "cancelled",
]);

export const workOrders = pgTable("work_orders", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  orderNumber:          text("order_number").notNull().unique().default(""),
  vehicleId:            uuid("vehicle_id").notNull().references(() => vehicles.id),
  customerId:           uuid("customer_id").notNull().references(() => customers.id),
  status:               workOrderStatusEnum("status").notNull().default("queued"),
  receivedAt:           timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  promisedAt:           timestamp("promised_at", { withTimezone: true }),
  startedAt:            timestamp("started_at", { withTimezone: true }),
  finishedAt:           timestamp("finished_at", { withTimezone: true }),
  mileageIn:            integer("mileage_in"),
  mileageOut:           integer("mileage_out"),
  customerComplaint:    text("customer_complaint"),
  internalNotes:        text("internal_notes"),
  inspectionTemplateId: uuid("inspection_template_id")
                          .references(() => inspectionTemplates.id, { onDelete: "set null" }),
  invoiceId:            uuid("invoice_id"),
  laborRateOverride:    numeric("labor_rate_override", { precision: 10, scale: 2 }),
  createdBy:            uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workOrderMechanics = pgTable("work_order_mechanics", {
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  mechanicId:  uuid("mechanic_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  isLead:      boolean("is_lead").notNull().default(false),
  assignedAt:  timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.workOrderId, t.mechanicId] }),
}));

export const workOrderTasks = pgTable("work_order_tasks", {
  id:             uuid("id").primaryKey().defaultRandom(),
  workOrderId:    uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  assignedTo:     uuid("assigned_to").references(() => userProfiles.id, { onDelete: "set null" }),
  description:    text("description").notNull(),
  estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
  actualHours:    numeric("actual_hours", { precision: 6, scale: 2 }),
  isCompleted:    boolean("is_completed").notNull().default(false),
  completedAt:    timestamp("completed_at", { withTimezone: true }),
  sortOrder:      integer("sort_order").notNull().default(0),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workOrderParts = pgTable("work_order_parts", {
  id:            uuid("id").primaryKey().defaultRandom(),
  workOrderId:   uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  partId:        uuid("part_id").notNull().references(() => parts.id),
  quantity:      numeric("quantity", { precision: 12, scale: 4 }).notNull(),
  unitCostPrice: numeric("unit_cost_price", { precision: 12, scale: 4 }).notNull(),
  unitSellPrice: numeric("unit_sell_price", { precision: 12, scale: 4 }).notNull(),
  vmbEligible:   boolean("vmb_eligible").notNull().default(false),
  costBasis:     numeric("cost_basis", { precision: 12, scale: 4 }),
  addedBy:       uuid("added_by").references(() => userProfiles.id, { onDelete: "set null" }),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspectionResults = pgTable("inspection_results", {
  id:             uuid("id").primaryKey().defaultRandom(),
  workOrderId:    uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  templateItemId: text("template_item_id").notNull(),
  sectionTitle:   text("section_title").notNull(),
  itemLabel:      text("item_label").notNull(),
  resultPassFail: text("result_pass_fail"),
  resultValue:    numeric("result_value", { precision: 12, scale: 4 }),
  resultNote:     text("result_note"),
  photoUrls:      text("photo_urls").array(),
  inspectedBy:    uuid("inspected_by").references(() => userProfiles.id, { onDelete: "set null" }),
  inspectedAt:    timestamp("inspected_at", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  vehicle:   one(vehicles, { fields: [workOrders.vehicleId], references: [vehicles.id] }),
  customer:  one(customers, { fields: [workOrders.customerId], references: [customers.id] }),
  createdBy: one(userProfiles, { fields: [workOrders.createdBy], references: [userProfiles.id] }),
  mechanics:          many(workOrderMechanics),
  tasks:              many(workOrderTasks),
  parts:              many(workOrderParts),
  inspectionResults:  many(inspectionResults),
}));

export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;
export type WorkOrderTask = typeof workOrderTasks.$inferSelect;
export type WorkOrderPart = typeof workOrderParts.$inferSelect;
export type InspectionResult = typeof inspectionResults.$inferSelect;

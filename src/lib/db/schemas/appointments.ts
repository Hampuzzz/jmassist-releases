import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { vehicles } from "./vehicles";
import { customers } from "./customers";
import { resources } from "./resources";
import { userProfiles } from "./users";
import { workOrders } from "./work-orders";

export const appointments = pgTable("appointments", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  workOrderId:        uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  vehicleId:          uuid("vehicle_id").notNull().references(() => vehicles.id),
  customerId:         uuid("customer_id").notNull().references(() => customers.id),
  resourceId:         uuid("resource_id").references(() => resources.id, { onDelete: "set null" }),
  mechanicId:         uuid("mechanic_id").references(() => userProfiles.id, { onDelete: "set null" }),
  scheduledStart:     timestamp("scheduled_start", { withTimezone: true }).notNull(),
  scheduledEnd:       timestamp("scheduled_end", { withTimezone: true }).notNull(),
  source:             text("source").notNull().default("internal"),
  status:             text("status").notNull().default("confirmed"),
  serviceDescription: text("service_description"),
  customerNotes:      text("customer_notes"),
  internalNotes:      text("internal_notes"),
  createdBy:          uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const openingHours = pgTable("opening_hours", {
  id:         uuid("id").primaryKey().defaultRandom(),
  dayOfWeek:  text("day_of_week").notNull(), // stored as smallint in DB
  openTime:   text("open_time").notNull().default("08:00"),
  closeTime:  text("close_time").notNull().default("17:00"),
  isClosed:   text("is_closed").notNull().default("false"),
});

export const blockedPeriods = pgTable("blocked_periods", {
  id:         uuid("id").primaryKey().defaultRandom(),
  title:      text("title").notNull(),
  blockStart: timestamp("block_start", { withTimezone: true }).notNull(),
  blockEnd:   timestamp("block_end", { withTimezone: true }).notNull(),
  resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "cascade" }),
  mechanicId: uuid("mechanic_id").references(() => userProfiles.id, { onDelete: "cascade" }),
  createdBy:  uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  vehicle:   one(vehicles,      { fields: [appointments.vehicleId],   references: [vehicles.id] }),
  customer:  one(customers,     { fields: [appointments.customerId],  references: [customers.id] }),
  resource:  one(resources,     { fields: [appointments.resourceId],  references: [resources.id] }),
  mechanic:  one(userProfiles,  { fields: [appointments.mechanicId],  references: [userProfiles.id] }),
  workOrder: one(workOrders,    { fields: [appointments.workOrderId], references: [workOrders.id] }),
}));

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type BlockedPeriod = typeof blockedPeriods.$inferSelect;

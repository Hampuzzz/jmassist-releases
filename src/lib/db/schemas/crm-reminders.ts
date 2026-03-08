import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";
import { vehicles } from "./vehicles";
import { userProfiles } from "./users";

export const crmReminders = pgTable("crm_reminders", {
  id:         uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  vehicleId:  uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  type:       text("type").notNull(), // service | inspection | tire_change | custom
  title:      text("title").notNull(),
  message:    text("message").notNull(),
  dueDate:    date("due_date").notNull(),
  status:     text("status").notNull().default("pending"), // pending | approved | sent | dismissed
  approvedBy: uuid("approved_by").references(() => userProfiles.id, { onDelete: "set null" }),
  sentAt:     timestamp("sent_at", { withTimezone: true }),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crmRemindersRelations = relations(crmReminders, ({ one }) => ({
  customer: one(customers, { fields: [crmReminders.customerId], references: [customers.id] }),
  vehicle:  one(vehicles, { fields: [crmReminders.vehicleId], references: [vehicles.id] }),
  approver: one(userProfiles, { fields: [crmReminders.approvedBy], references: [userProfiles.id] }),
}));

export type CrmReminder = typeof crmReminders.$inferSelect;
export type NewCrmReminder = typeof crmReminders.$inferInsert;

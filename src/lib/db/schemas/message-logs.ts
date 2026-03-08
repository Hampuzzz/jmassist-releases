import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";

export const messageLogs = pgTable("message_logs", {
  id:                uuid("id").primaryKey().defaultRandom(),
  channel:           text("channel").notNull().default("sms"), // sms | email
  type:              text("type").notNull(), // status_update | approval_request | crm_reminder | vhc_report | manual
  recipientPhone:    text("recipient_phone"),
  recipientEmail:    text("recipient_email"),
  recipientName:     text("recipient_name"),
  customerId:        uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  message:           text("message").notNull(),
  status:            text("status").notNull().default("sent"), // sent | delivered | failed | mock
  externalId:        text("external_id"), // 46elks SMS id
  costSek:           integer("cost_sek"), // cost in SEK öre from 46elks
  errorMessage:      text("error_message"),
  relatedEntityType: text("related_entity_type"), // work_order | crm_reminder | vhc | approval
  relatedEntityId:   uuid("related_entity_id"),
  sentAt:            timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageLogsRelations = relations(messageLogs, ({ one }) => ({
  customer: one(customers, { fields: [messageLogs.customerId], references: [customers.id] }),
}));

export type MessageLog = typeof messageLogs.$inferSelect;
export type NewMessageLog = typeof messageLogs.$inferInsert;

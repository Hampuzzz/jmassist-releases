import { pgTable, uuid, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { workOrders, inspectionResults } from "./work-orders";

export const approvalRequests = pgTable("approval_requests", {
  id:               uuid("id").primaryKey().defaultRandom(),
  workOrderId:      uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  token:            text("token").notNull().unique(),
  status:           text("status").notNull().default("pending"),
  customerMessage:  text("customer_message"),
  respondedAt:      timestamp("responded_at", { withTimezone: true }),
  expiresAt:        timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalItems = pgTable("approval_items", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  approvalRequestId:   uuid("approval_request_id").notNull().references(() => approvalRequests.id, { onDelete: "cascade" }),
  inspectionResultId:  uuid("inspection_result_id").references(() => inspectionResults.id, { onDelete: "set null" }),
  description:         text("description").notNull(),
  estimatedCost:       numeric("estimated_cost", { precision: 12, scale: 2 }),
  photoUrls:           text("photo_urls").array(),
  approved:            boolean("approved"),
  customerNote:        text("customer_note"),
  sortOrder:           integer("sort_order").notNull().default(0),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalRequestsRelations = relations(approvalRequests, ({ one, many }) => ({
  workOrder: one(workOrders, { fields: [approvalRequests.workOrderId], references: [workOrders.id] }),
  items:     many(approvalItems),
}));

export const approvalItemsRelations = relations(approvalItems, ({ one }) => ({
  approvalRequest:  one(approvalRequests, { fields: [approvalItems.approvalRequestId], references: [approvalRequests.id] }),
  inspectionResult: one(inspectionResults, { fields: [approvalItems.inspectionResultId], references: [inspectionResults.id] }),
}));

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
export type ApprovalItem = typeof approvalItems.$inferSelect;
export type NewApprovalItem = typeof approvalItems.$inferInsert;

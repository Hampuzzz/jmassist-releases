import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { workOrders, workOrderTasks } from "./work-orders";
import { userProfiles } from "./users";

export const timeEntries = pgTable("time_entries", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  workOrderId:        uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  taskId:             uuid("task_id").references(() => workOrderTasks.id, { onDelete: "set null" }),
  mechanicId:         uuid("mechanic_id").notNull().references(() => userProfiles.id),
  startedAt:          timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  pausedAt:           timestamp("paused_at", { withTimezone: true }),
  stoppedAt:          timestamp("stopped_at", { withTimezone: true }),
  totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
  notes:              text("notes"),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  workOrder: one(workOrders, { fields: [timeEntries.workOrderId], references: [workOrders.id] }),
  task:      one(workOrderTasks, { fields: [timeEntries.taskId], references: [workOrderTasks.id] }),
  mechanic:  one(userProfiles, { fields: [timeEntries.mechanicId], references: [userProfiles.id] }),
}));

export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;

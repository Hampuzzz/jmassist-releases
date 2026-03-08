import { pgTable, uuid, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const resources = pgTable("resources", {
  id:           uuid("id").primaryKey().defaultRandom(),
  name:         text("name").notNull(),
  resourceType: text("resource_type").notNull().default("lift"),
  isActive:     boolean("is_active").notNull().default(true),
  notes:        text("notes"),
  sortOrder:    integer("sort_order").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const workshopSettings = pgTable("workshop_settings", {
  key:       text("key").primaryKey(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorkshopSetting = typeof workshopSettings.$inferSelect;

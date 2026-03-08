import { pgTable, pgEnum, uuid, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "receptionist", "mechanic"]);

export const userProfiles = pgTable("user_profiles", {
  id:         uuid("id").primaryKey(),
  fullName:   text("full_name").notNull(),
  role:       userRoleEnum("role").notNull().default("mechanic"),
  phone:      text("phone"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  isActive:   boolean("is_active").notNull().default(true),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

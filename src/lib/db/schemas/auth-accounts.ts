import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userProfiles } from "./users";

export const authAccounts = pgTable("auth_accounts", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  userId:       uuid("user_id").references(() => userProfiles.id, { onDelete: "cascade" }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(userProfiles, { fields: [authAccounts.userId], references: [userProfiles.id] }),
}));

export type AuthAccount = typeof authAccounts.$inferSelect;
export type NewAuthAccount = typeof authAccounts.$inferInsert;

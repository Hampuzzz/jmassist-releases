import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";

export const portalAccounts = pgTable("portal_accounts", {
  id:           uuid("id").primaryKey().defaultRandom(),
  customerId:   uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  inviteToken:  text("invite_token"),
  inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
  resetToken:   text("reset_token"),
  resetExpiresAt: timestamp("reset_expires_at", { withTimezone: true }),
  isActive:     boolean("is_active").notNull().default(true),
  lastLoginAt:  timestamp("last_login_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const portalAccountsRelations = relations(portalAccounts, ({ one }) => ({
  customer: one(customers, { fields: [portalAccounts.customerId], references: [customers.id] }),
}));

export type PortalAccount = typeof portalAccounts.$inferSelect;
export type NewPortalAccount = typeof portalAccounts.$inferInsert;

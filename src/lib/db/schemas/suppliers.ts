import { pgTable, uuid, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { parts } from "./parts";

export const suppliers = pgTable("suppliers", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  name:                 text("name").notNull(),
  orgNr:                text("org_nr"),
  contactName:          text("contact_name"),
  email:                text("email"),
  phone:                text("phone"),
  addressLine1:         text("address_line1"),
  postalCode:           text("postal_code"),
  city:                 text("city"),
  country:              text("country").notNull().default("SE"),
  integrationType:      text("integration_type"),
  apiCredentials:       jsonb("api_credentials"),
  apiBaseUrl:           text("api_base_url"),
  defaultLeadTimeDays:  integer("default_lead_time_days"),
  notes:                text("notes"),
  isActive:             boolean("is_active").notNull().default(true),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  parts: many(parts),
}));

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;

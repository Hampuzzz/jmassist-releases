import { pgTable, uuid, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { vehicles } from "./vehicles";
import { invoices } from "./invoices";

export const customers = pgTable("customers", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  isCompany:                boolean("is_company").notNull().default(false),
  firstName:                text("first_name"),
  lastName:                 text("last_name"),
  personalNr:               text("personal_nr"),
  companyName:              text("company_name"),
  orgNr:                    text("org_nr"),
  email:                    text("email"),
  phone:                    text("phone"),
  phoneAlt:                 text("phone_alt"),
  addressLine1:             text("address_line1"),
  addressLine2:             text("address_line2"),
  postalCode:               text("postal_code"),
  city:                     text("city"),
  country:                  text("country").notNull().default("SE"),
  defaultPaymentTermsDays:  integer("default_payment_terms_days").notNull().default(30),
  vatExempt:                boolean("vat_exempt").notNull().default(false),
  notes:                    text("notes"),
  // Fortnox integration
  fortnoxCustomerNumber:    text("fortnox_customer_number"),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  vehicles: many(vehicles),
  invoices: many(invoices),
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

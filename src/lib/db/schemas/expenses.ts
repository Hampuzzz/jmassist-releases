import {
  pgTable, pgEnum, uuid, text, boolean, timestamp, date, numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userProfiles } from "./users";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "rent",           // Hyra
  "electricity",    // El
  "salary",         // Löner
  "insurance",      // Försäkring
  "tools",          // Verktyg
  "consumables",    // Förbrukningsmaterial
  "vehicle",        // Firmabil/transport
  "marketing",      // Marknadsföring
  "software",       // Programvara/licenser
  "maintenance",    // Underhåll lokal
  "accounting",     // Bokföring/revision
  "telecom",        // Telefon/internet
  "other",          // Övrigt
]);

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent:         "Hyra",
  electricity:  "El",
  salary:       "Löner",
  insurance:    "Försäkring",
  tools:        "Verktyg",
  consumables:  "Förbrukningsmaterial",
  vehicle:      "Firmabil/transport",
  marketing:    "Marknadsföring",
  software:     "Programvara/licenser",
  maintenance:  "Underhåll lokal",
  accounting:   "Bokföring/revision",
  telecom:      "Telefon/internet",
  other:        "Övrigt",
};

export const expenses = pgTable("expenses", {
  id:           uuid("id").primaryKey().defaultRandom(),
  date:         date("date").notNull(),
  category:     expenseCategoryEnum("category").notNull(),
  amount:       numeric("amount", { precision: 14, scale: 2 }).notNull(),
  vatAmount:    numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  vatDeductible: boolean("vat_deductible").notNull().default(true),
  supplier:     text("supplier"),
  description:  text("description").notNull(),
  isRecurring:  boolean("is_recurring").notNull().default(false),
  receiptRef:   text("receipt_ref"),
  createdBy:    uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expensesRelations = relations(expenses, ({ one }) => ({
  createdBy: one(userProfiles, { fields: [expenses.createdBy], references: [userProfiles.id] }),
}));

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

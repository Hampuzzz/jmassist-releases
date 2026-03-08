import { pgTable, uuid, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const inspectionTemplates = pgTable("inspection_templates", {
  id:           uuid("id").primaryKey().defaultRandom(),
  name:         text("name").notNull(),
  description:  text("description"),
  templateData: jsonb("template_data").notNull(),
  vehicleTypes: text("vehicle_types").array(),
  isDefault:    boolean("is_default").notNull().default(false),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InspectionTemplate = typeof inspectionTemplates.$inferSelect;

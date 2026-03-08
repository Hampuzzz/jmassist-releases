import { pgTable, pgEnum, uuid, text, boolean, timestamp, integer, smallint, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";
import { workOrders } from "./work-orders";

export const fuelTypeEnum = pgEnum("fuel_type", [
  "petrol", "diesel", "hybrid", "electric",
  "plug_in_hybrid", "ethanol", "lpg", "hydrogen", "other",
]);

export const vehicles = pgTable("vehicles", {
  id:                uuid("id").primaryKey().defaultRandom(),
  customerId:        uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  regNr:             text("reg_nr").notNull().unique(),
  vin:               text("vin").unique(),
  brand:             text("brand").notNull(),
  model:             text("model").notNull(),
  modelYear:         smallint("model_year"),
  color:             text("color"),
  fuelType:          fuelTypeEnum("fuel_type"),
  engineSizeCc:      integer("engine_size_cc"),
  powerKw:           integer("power_kw"),
  powerHp:           integer("power_hp"),
  transmission:      text("transmission"),
  driveType:         text("drive_type"),
  engineCode:        text("engine_code"),
  mileageKm:         integer("mileage_km"),
  mileageUpdatedAt:  timestamp("mileage_updated_at", { withTimezone: true }),
  externalData:      jsonb("external_data"),
  externalFetchedAt: timestamp("external_fetched_at", { withTimezone: true }),
  notes:             text("notes"),
  isActive:          boolean("is_active").notNull().default(true),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  customer:   one(customers, { fields: [vehicles.customerId], references: [customers.id] }),
  workOrders: many(workOrders),
}));

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;

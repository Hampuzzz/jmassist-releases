import { pgTable, uuid, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { parts } from "./parts";

export const partPriceSearches = pgTable("part_price_searches", {
  id:          uuid("id").primaryKey().defaultRandom(),
  partId:      uuid("part_id").references(() => parts.id, { onDelete: "cascade" }),
  searchQuery: text("search_query").notNull(),
  results:     jsonb("results").notNull().default([]),
  bestPrice:   numeric("best_price", { precision: 12, scale: 4 }),
  bestMargin:  numeric("best_margin", { precision: 12, scale: 4 }),
  searchedAt:  timestamp("searched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partPriceSearchesRelations = relations(partPriceSearches, ({ one }) => ({
  part: one(parts, { fields: [partPriceSearches.partId], references: [parts.id] }),
}));

export type PartPriceSearch = typeof partPriceSearches.$inferSelect;
export type NewPartPriceSearch = typeof partPriceSearches.$inferInsert;

/** Shape of each result inside the JSONB `results` array */
export interface PriceResult {
  source:       string;   // "trodo" | "autodoc" | "mekonomen" | "local"
  sourceName:   string;   // Display name
  price:        number;
  deliveryDays: number;
  inStock:      boolean;
  url?:         string;
}

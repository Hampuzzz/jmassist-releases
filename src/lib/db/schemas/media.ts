import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { workOrders } from "./work-orders";
import { vhcItems } from "./vhc";
import { userProfiles } from "./users";

export const media = pgTable("media", {
  id:            uuid("id").primaryKey().defaultRandom(),
  workOrderId:   uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }),
  vhcItemId:     uuid("vhc_item_id").references(() => vhcItems.id, { onDelete: "cascade" }),
  uploadedBy:    uuid("uploaded_by").references(() => userProfiles.id, { onDelete: "set null" }),
  filePath:      text("file_path").notNull(),
  fileName:      text("file_name").notNull(),
  fileType:      text("file_type").notNull(),
  fileSize:      integer("file_size"),
  thumbnailPath: text("thumbnail_path"),
  caption:       text("caption"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaRelations = relations(media, ({ one }) => ({
  workOrder: one(workOrders, { fields: [media.workOrderId], references: [workOrders.id] }),
  vhcItem:   one(vhcItems, { fields: [media.vhcItemId], references: [vhcItems.id] }),
  uploader:  one(userProfiles, { fields: [media.uploadedBy], references: [userProfiles.id] }),
}));

export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

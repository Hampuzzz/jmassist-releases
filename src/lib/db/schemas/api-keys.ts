import { pgTable, uuid, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const apiKeys = pgTable("api_keys", {
  id:             uuid("id").primaryKey().defaultRandom(),
  name:           text("name").notNull(),
  keyHash:        text("key_hash").notNull().unique(),
  keyPrefix:      text("key_prefix").notNull(),
  allowedOrigins: text("allowed_origins").array(),
  scopes:         text("scopes").array().notNull().default(["booking:write"]),
  isActive:       boolean("is_active").notNull().default(true),
  lastUsedAt:     timestamp("last_used_at", { withTimezone: true }),
  expiresAt:      timestamp("expires_at", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingRequestLog = pgTable("booking_request_log", {
  id:            uuid("id").primaryKey().defaultRandom(),
  endpoint:      text("endpoint").notNull(),
  method:        text("method").notNull(),
  origin:        text("origin"),
  ipAddress:     text("ip_address"),
  apiKeyId:      uuid("api_key_id"),
  requestBody:   jsonb("request_body"),
  responseStatus: integer("response_status"),
  appointmentId:  uuid("appointment_id"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type BookingRequestLog = typeof bookingRequestLog.$inferSelect;

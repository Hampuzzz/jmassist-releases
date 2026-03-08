-- ============================================================================
-- JM Assist v2.0 — PostgreSQL Initialization Script
-- Genereras från Drizzle ORM schemas
-- Kör vid: docker compose up (första gången, tom databas)
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE "public"."user_role" AS ENUM ('admin', 'receptionist', 'mechanic');

CREATE TYPE "public"."fuel_type" AS ENUM (
  'petrol', 'diesel', 'hybrid', 'electric',
  'plug_in_hybrid', 'ethanol', 'lpg', 'hydrogen', 'other'
);

CREATE TYPE "public"."stock_movement_reason" AS ENUM (
  'work_order_use', 'manual_adjustment', 'supplier_delivery',
  'return_to_supplier', 'write_off', 'initial_stock'
);

CREATE TYPE "public"."work_order_status" AS ENUM (
  'queued', 'diagnosing', 'ongoing', 'ordering_parts', 'waiting_for_parts',
  'ready_for_pickup', 'finished', 'cancelled'
);

CREATE TYPE "public"."invoice_status" AS ENUM (
  'draft', 'sent', 'paid', 'overdue', 'cancelled'
);

CREATE TYPE "public"."invoice_type" AS ENUM ('quote', 'invoice');

CREATE TYPE "public"."invoice_line_type" AS ENUM (
  'labor', 'part', 'fee', 'discount'
);

CREATE TYPE "public"."expense_category" AS ENUM (
  'rent', 'electricity', 'salary', 'insurance', 'tools',
  'consumables', 'vehicle', 'marketing', 'software',
  'maintenance', 'accounting', 'telecom', 'other'
);

-- ============================================================================
-- 2. TABLES (ordnade efter beroenden)
-- ============================================================================

CREATE TABLE "public"."user_profiles" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "full_name"   text NOT NULL,
  "role"        "public"."user_role" NOT NULL DEFAULT 'mechanic',
  "phone"       text,
  "hourly_rate" numeric(10, 2),
  "is_active"   boolean NOT NULL DEFAULT true,
  "created_at"  timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."auth_accounts" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"         text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "user_id"       uuid REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE,
  "created_at"    timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."customers" (
  "id"                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_company"                  boolean NOT NULL DEFAULT false,
  "first_name"                  text,
  "last_name"                   text,
  "personal_nr"                 text,
  "company_name"                text,
  "org_nr"                      text,
  "email"                       text,
  "phone"                       text,
  "phone_alt"                   text,
  "address_line1"               text,
  "address_line2"               text,
  "postal_code"                 text,
  "city"                        text,
  "country"                     text NOT NULL DEFAULT 'SE',
  "default_payment_terms_days"  integer NOT NULL DEFAULT 30,
  "vat_exempt"                  boolean NOT NULL DEFAULT false,
  "notes"                       text,
  "fortnox_customer_number"     text,
  "created_at"                  timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."vehicles" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id"         uuid REFERENCES "public"."customers"("id") ON DELETE SET NULL,
  "reg_nr"              text NOT NULL UNIQUE,
  "vin"                 text UNIQUE,
  "brand"               text NOT NULL,
  "model"               text NOT NULL,
  "model_year"          smallint,
  "color"               text,
  "fuel_type"           "public"."fuel_type",
  "engine_size_cc"      integer,
  "power_kw"            integer,
  "power_hp"            integer,
  "transmission"        text,
  "drive_type"          text,
  "engine_code"         text,
  "mileage_km"          integer,
  "mileage_updated_at"  timestamp with time zone,
  "external_data"       jsonb,
  "external_fetched_at" timestamp with time zone,
  "notes"               text,
  "is_active"           boolean NOT NULL DEFAULT true,
  "created_at"          timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."suppliers" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                   text NOT NULL,
  "org_nr"                 text,
  "contact_name"           text,
  "email"                  text,
  "phone"                  text,
  "address_line1"          text,
  "postal_code"            text,
  "city"                   text,
  "country"                text NOT NULL DEFAULT 'SE',
  "integration_type"       text,
  "api_credentials"        jsonb,
  "api_base_url"           text,
  "default_lead_time_days" integer,
  "notes"                  text,
  "is_active"              boolean NOT NULL DEFAULT true,
  "created_at"             timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."parts" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplier_id"     uuid REFERENCES "public"."suppliers"("id") ON DELETE SET NULL,
  "part_number"     text NOT NULL,
  "internal_number" text,
  "name"            text NOT NULL,
  "description"     text,
  "category"        text,
  "unit"            text NOT NULL DEFAULT 'pcs',
  "cost_price"      numeric(12, 4) NOT NULL DEFAULT 0,
  "sell_price"      numeric(12, 4) NOT NULL DEFAULT 0,
  "markup_pct"      numeric(8, 4),
  "vat_rate_pct"    numeric(5, 2) NOT NULL DEFAULT 25.00,
  "vmb_eligible"    boolean NOT NULL DEFAULT false,
  "stock_qty"       numeric(12, 4) NOT NULL DEFAULT 0,
  "stock_min_qty"   numeric(12, 4) NOT NULL DEFAULT 0,
  "stock_location"  text,
  "is_active"       boolean NOT NULL DEFAULT true,
  "notes"           text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."resources" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"          text NOT NULL,
  "resource_type" text NOT NULL DEFAULT 'lift',
  "is_active"     boolean NOT NULL DEFAULT true,
  "notes"         text,
  "sort_order"    integer NOT NULL DEFAULT 0,
  "created_at"    timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."inspection_templates" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"          text NOT NULL,
  "description"   text,
  "template_data" jsonb NOT NULL,
  "vehicle_types" text[],
  "is_default"    boolean NOT NULL DEFAULT false,
  "is_active"     boolean NOT NULL DEFAULT true,
  "created_at"    timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."work_orders" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_number"           text NOT NULL UNIQUE DEFAULT '',
  "vehicle_id"             uuid NOT NULL REFERENCES "public"."vehicles"("id"),
  "customer_id"            uuid NOT NULL REFERENCES "public"."customers"("id"),
  "status"                 "public"."work_order_status" NOT NULL DEFAULT 'queued',
  "received_at"            timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "promised_at"            timestamp with time zone,
  "started_at"             timestamp with time zone,
  "finished_at"            timestamp with time zone,
  "mileage_in"             integer,
  "mileage_out"            integer,
  "customer_complaint"     text,
  "internal_notes"         text,
  "inspection_template_id" uuid REFERENCES "public"."inspection_templates"("id") ON DELETE SET NULL,
  "invoice_id"             uuid,
  "labor_rate_override"    numeric(10, 2),
  "created_by"             uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "created_at"             timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."work_order_mechanics" (
  "work_order_id" uuid NOT NULL REFERENCES "public"."work_orders"("id") ON DELETE CASCADE,
  "mechanic_id"   uuid NOT NULL REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE,
  "is_lead"       boolean NOT NULL DEFAULT false,
  "assigned_at"   timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("work_order_id", "mechanic_id")
);

CREATE TABLE "public"."work_order_tasks" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_order_id"   uuid NOT NULL REFERENCES "public"."work_orders"("id") ON DELETE CASCADE,
  "assigned_to"     uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "description"     text NOT NULL,
  "estimated_hours" numeric(6, 2),
  "actual_hours"    numeric(6, 2),
  "is_completed"    boolean NOT NULL DEFAULT false,
  "completed_at"    timestamp with time zone,
  "sort_order"      integer NOT NULL DEFAULT 0,
  "created_at"      timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."work_order_parts" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_order_id"    uuid NOT NULL REFERENCES "public"."work_orders"("id") ON DELETE CASCADE,
  "part_id"          uuid NOT NULL REFERENCES "public"."parts"("id"),
  "quantity"         numeric(12, 4) NOT NULL,
  "unit_cost_price"  numeric(12, 4) NOT NULL,
  "unit_sell_price"  numeric(12, 4) NOT NULL,
  "vmb_eligible"     boolean NOT NULL DEFAULT false,
  "cost_basis"       numeric(12, 4),
  "added_by"         uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "notes"            text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."stock_movements" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "part_id"       uuid NOT NULL REFERENCES "public"."parts"("id"),
  "work_order_id" uuid,
  "user_id"       uuid,
  "reason"        "public"."stock_movement_reason" NOT NULL,
  "qty_change"    numeric(12, 4) NOT NULL,
  "qty_before"    numeric(12, 4) NOT NULL,
  "qty_after"     numeric(12, 4) NOT NULL,
  "unit_cost"     numeric(12, 4),
  "notes"         text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."inspection_results" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_order_id"     uuid NOT NULL REFERENCES "public"."work_orders"("id") ON DELETE CASCADE,
  "template_item_id"  text NOT NULL,
  "section_title"     text NOT NULL,
  "item_label"        text NOT NULL,
  "result_pass_fail"  text,
  "result_value"      numeric(12, 4),
  "result_note"       text,
  "photo_urls"        text[],
  "inspected_by"      uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "inspected_at"      timestamp with time zone,
  "created_at"        timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."appointments" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_order_id"      uuid REFERENCES "public"."work_orders"("id") ON DELETE SET NULL,
  "vehicle_id"         uuid NOT NULL REFERENCES "public"."vehicles"("id"),
  "customer_id"        uuid NOT NULL REFERENCES "public"."customers"("id"),
  "resource_id"        uuid REFERENCES "public"."resources"("id") ON DELETE SET NULL,
  "mechanic_id"        uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "scheduled_start"    timestamp with time zone NOT NULL,
  "scheduled_end"      timestamp with time zone NOT NULL,
  "source"             text NOT NULL DEFAULT 'internal',
  "status"             text NOT NULL DEFAULT 'confirmed',
  "service_description" text,
  "customer_notes"     text,
  "internal_notes"     text,
  "created_by"         uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."opening_hours" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "day_of_week" text NOT NULL,
  "open_time"   text NOT NULL DEFAULT '08:00',
  "close_time"  text NOT NULL DEFAULT '17:00',
  "is_closed"   text NOT NULL DEFAULT 'false'
);

CREATE TABLE "public"."blocked_periods" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title"       text NOT NULL,
  "block_start" timestamp with time zone NOT NULL,
  "block_end"   timestamp with time zone NOT NULL,
  "resource_id" uuid REFERENCES "public"."resources"("id") ON DELETE CASCADE,
  "mechanic_id" uuid REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE,
  "created_by"  uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."invoices" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_number"          text UNIQUE,
  "type"                    "public"."invoice_type" NOT NULL DEFAULT 'invoice',
  "status"                  "public"."invoice_status" NOT NULL DEFAULT 'draft',
  "customer_id"             uuid NOT NULL REFERENCES "public"."customers"("id"),
  "work_order_id"           uuid,
  "converted_from_quote_id" uuid,
  "invoice_date"            date,
  "due_date"                date,
  "subtotal_ex_vat"         numeric(14, 4) NOT NULL DEFAULT 0,
  "vat_amount"              numeric(14, 4) NOT NULL DEFAULT 0,
  "vmb_vat_amount"          numeric(14, 4) NOT NULL DEFAULT 0,
  "total_inc_vat"           numeric(14, 4) NOT NULL DEFAULT 0,
  "payment_terms_days"      integer NOT NULL DEFAULT 30,
  "paid_at"                 timestamp with time zone,
  "payment_method"          text,
  "payment_reference"       text,
  "sender_snapshot"         jsonb,
  "notes"                   text,
  "fortnox_id"              text,
  "fortnox_sync_status"     text NOT NULL DEFAULT 'not_synced',
  "fortnox_synced_at"       timestamp with time zone,
  "fortnox_error_msg"       text,
  "created_by"              uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "created_at"              timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."invoice_lines" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_id"          uuid NOT NULL REFERENCES "public"."invoices"("id") ON DELETE CASCADE,
  "sort_order"          integer NOT NULL DEFAULT 0,
  "line_type"           "public"."invoice_line_type" NOT NULL,
  "part_id"             uuid REFERENCES "public"."parts"("id") ON DELETE SET NULL,
  "work_order_task_id"  uuid REFERENCES "public"."work_order_tasks"("id") ON DELETE SET NULL,
  "description"         text NOT NULL,
  "quantity"            numeric(12, 4) NOT NULL DEFAULT 1,
  "unit"                text NOT NULL DEFAULT 'pcs',
  "unit_price"          numeric(12, 4) NOT NULL,
  "discount_pct"        numeric(5, 2) NOT NULL DEFAULT 0,
  "line_total"          numeric(14, 4),
  "vat_rate_pct"        numeric(5, 2) NOT NULL DEFAULT 25.00,
  "vat_amount"          numeric(14, 4),
  "vmb_eligible"        boolean NOT NULL DEFAULT false,
  "cost_basis"          numeric(12, 4),
  "vmb_vat_amount"      numeric(14, 4),
  "created_at"          timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."api_keys" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"            text NOT NULL,
  "key_hash"        text NOT NULL UNIQUE,
  "key_prefix"      text NOT NULL,
  "allowed_origins" text[],
  "scopes"          text[] NOT NULL DEFAULT ARRAY['booking:write'],
  "is_active"       boolean NOT NULL DEFAULT true,
  "last_used_at"    timestamp with time zone,
  "expires_at"      timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."booking_request_log" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "endpoint"        text NOT NULL,
  "method"          text NOT NULL,
  "origin"          text,
  "ip_address"      text,
  "api_key_id"      uuid,
  "request_body"    jsonb,
  "response_status" integer,
  "appointment_id"  uuid,
  "created_at"      timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."approval_requests" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_order_id"    uuid NOT NULL REFERENCES "public"."work_orders"("id") ON DELETE CASCADE,
  "token"            text NOT NULL UNIQUE,
  "status"           text NOT NULL DEFAULT 'pending',
  "customer_message" text,
  "responded_at"     timestamp with time zone,
  "expires_at"       timestamp with time zone NOT NULL,
  "created_at"       timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."approval_items" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "approval_request_id" uuid NOT NULL REFERENCES "public"."approval_requests"("id") ON DELETE CASCADE,
  "inspection_result_id" uuid REFERENCES "public"."inspection_results"("id") ON DELETE SET NULL,
  "description"         text NOT NULL,
  "estimated_cost"      numeric(12, 2),
  "photo_urls"          text[],
  "approved"            boolean,
  "customer_note"       text,
  "sort_order"          integer NOT NULL DEFAULT 0,
  "created_at"          timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."expenses" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date"           date NOT NULL,
  "category"       "public"."expense_category" NOT NULL,
  "amount"         numeric(14, 2) NOT NULL,
  "vat_amount"     numeric(14, 2) NOT NULL DEFAULT 0,
  "vat_deductible" boolean NOT NULL DEFAULT true,
  "supplier"       text,
  "description"    text NOT NULL,
  "is_recurring"   boolean NOT NULL DEFAULT false,
  "receipt_ref"    text,
  "created_by"     uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."vehicle_health_checks" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_order_id"         uuid NOT NULL REFERENCES "public"."work_orders"("id") ON DELETE CASCADE,
  "vehicle_id"            uuid NOT NULL REFERENCES "public"."vehicles"("id"),
  "mechanic_id"           uuid REFERENCES "public"."user_profiles"("id"),
  "public_token"          text NOT NULL UNIQUE,
  "status"                text NOT NULL DEFAULT 'draft',
  "customer_notified_at"  timestamp with time zone,
  "customer_approved_at"  timestamp with time zone,
  "notes"                 text,
  "created_at"            timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."vhc_items" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "check_id"          uuid NOT NULL REFERENCES "public"."vehicle_health_checks"("id") ON DELETE CASCADE,
  "category"          text NOT NULL,
  "label"             text NOT NULL,
  "severity"          text NOT NULL DEFAULT 'green',
  "comment"           text,
  "estimated_cost"    numeric(10, 2),
  "customer_approved" boolean DEFAULT false,
  "media_urls"        text[],
  "sort_order"        integer NOT NULL DEFAULT 0,
  "created_at"        timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."crm_reminders" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL REFERENCES "public"."customers"("id") ON DELETE CASCADE,
  "vehicle_id"  uuid REFERENCES "public"."vehicles"("id") ON DELETE SET NULL,
  "type"        text NOT NULL,
  "title"       text NOT NULL,
  "message"     text NOT NULL,
  "due_date"    date NOT NULL,
  "status"      text NOT NULL DEFAULT 'pending',
  "approved_by" uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "sent_at"     timestamp with time zone,
  "created_at"  timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."part_price_searches" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "part_id"      uuid REFERENCES "public"."parts"("id") ON DELETE CASCADE,
  "search_query" text NOT NULL,
  "results"      jsonb NOT NULL DEFAULT '[]'::jsonb,
  "best_price"   numeric(12, 4),
  "best_margin"  numeric(12, 4),
  "searched_at"  timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."media" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_order_id"   uuid REFERENCES "public"."work_orders"("id") ON DELETE CASCADE,
  "vhc_item_id"     uuid REFERENCES "public"."vhc_items"("id") ON DELETE CASCADE,
  "uploaded_by"     uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "file_path"       text NOT NULL,
  "file_name"       text NOT NULL,
  "file_type"       text NOT NULL,
  "file_size"       integer,
  "thumbnail_path"  text,
  "caption"         text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."purchase_orders" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplier_id"  uuid REFERENCES "public"."suppliers"("id") ON DELETE SET NULL,
  "work_order_id" uuid REFERENCES "public"."work_orders"("id") ON DELETE SET NULL,
  "status"       text NOT NULL DEFAULT 'delivered',
  "reference"    text,
  "notes"        text,
  "ordered_at"   timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "created_by"   uuid REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."purchase_order_lines" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_order_id" uuid NOT NULL REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE,
  "part_id"           uuid REFERENCES "public"."parts"("id") ON DELETE SET NULL,
  "part_number_raw"   text NOT NULL,
  "part_name_raw"     text NOT NULL,
  "quantity"          numeric(12, 4) NOT NULL,
  "unit_cost_price"   numeric(12, 4) NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "public"."message_logs" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel"             text NOT NULL DEFAULT 'sms',
  "type"                text NOT NULL,
  "recipient_phone"     text,
  "recipient_email"     text,
  "recipient_name"      text,
  "customer_id"         uuid REFERENCES "public"."customers"("id") ON DELETE SET NULL,
  "message"             text NOT NULL,
  "status"              text NOT NULL DEFAULT 'sent',
  "external_id"         text,
  "cost_sek"            integer,
  "error_message"       text,
  "related_entity_type" text,
  "related_entity_id"   uuid,
  "sent_at"             timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"          timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX ON "public"."user_profiles"("role");
CREATE INDEX ON "public"."user_profiles"("is_active");
CREATE INDEX ON "public"."auth_accounts"("user_id");
CREATE INDEX ON "public"."customers"("email");
CREATE INDEX ON "public"."vehicles"("customer_id");
CREATE INDEX ON "public"."vehicles"("reg_nr");
CREATE INDEX ON "public"."parts"("supplier_id");
CREATE INDEX ON "public"."parts"("part_number");
CREATE INDEX ON "public"."parts"("is_active");
CREATE INDEX ON "public"."work_orders"("vehicle_id");
CREATE INDEX ON "public"."work_orders"("customer_id");
CREATE INDEX ON "public"."work_orders"("status");
CREATE INDEX ON "public"."work_orders"("order_number");
CREATE INDEX ON "public"."work_order_tasks"("work_order_id");
CREATE INDEX ON "public"."work_order_parts"("work_order_id");
CREATE INDEX ON "public"."appointments"("vehicle_id");
CREATE INDEX ON "public"."appointments"("customer_id");
CREATE INDEX ON "public"."appointments"("scheduled_start");
CREATE INDEX ON "public"."invoices"("customer_id");
CREATE INDEX ON "public"."invoices"("status");
CREATE INDEX ON "public"."invoice_lines"("invoice_id");
CREATE INDEX ON "public"."approval_requests"("token");
CREATE INDEX ON "public"."vehicle_health_checks"("public_token");
CREATE INDEX ON "public"."vehicle_health_checks"("work_order_id");
CREATE INDEX ON "public"."vhc_items"("check_id");
CREATE INDEX ON "public"."crm_reminders"("customer_id");
CREATE INDEX ON "public"."media"("work_order_id");
CREATE INDEX ON "public"."purchase_orders"("work_order_id");
CREATE INDEX ON "public"."message_logs"("customer_id");
CREATE INDEX ON "public"."message_logs"("sent_at");
CREATE INDEX ON "public"."message_logs"("status");

-- ============================================================================
-- 4. DEFAULT DATA — Öppettider (måndag–fredag 08–17)
-- ============================================================================

INSERT INTO "public"."opening_hours" ("day_of_week", "open_time", "close_time", "is_closed") VALUES
  ('monday',    '08:00', '17:00', 'false'),
  ('tuesday',   '08:00', '17:00', 'false'),
  ('wednesday', '08:00', '17:00', 'false'),
  ('thursday',  '08:00', '17:00', 'false'),
  ('friday',    '08:00', '17:00', 'false'),
  ('saturday',  '08:00', '13:00', 'true'),
  ('sunday',    '08:00', '13:00', 'true');

-- ============================================================================
-- END OF INIT SCRIPT
-- Skapa admin-användare med: docker exec jmassist node scripts/create-admin.js
-- ============================================================================

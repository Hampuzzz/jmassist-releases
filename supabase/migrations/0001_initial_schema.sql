-- ============================================================
-- Migration: 0001_initial_schema.sql
-- Automotive Workshop ERP - PostgreSQL/Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE work_order_status AS ENUM (
  'queued',
  'diagnosing',
  'ongoing',
  'ordering_parts',
  'waiting_for_parts',
  'ready_for_pickup',
  'finished',
  'cancelled'
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TYPE invoice_type AS ENUM (
  'quote',
  'invoice'
);

CREATE TYPE invoice_line_type AS ENUM (
  'labor',
  'part',
  'fee',
  'discount'
);

CREATE TYPE fuel_type AS ENUM (
  'petrol',
  'diesel',
  'hybrid',
  'electric',
  'plug_in_hybrid',
  'ethanol',
  'lpg',
  'hydrogen',
  'other'
);

CREATE TYPE user_role AS ENUM (
  'admin',
  'receptionist',
  'mechanic'
);

CREATE TYPE stock_movement_reason AS ENUM (
  'work_order_use',
  'manual_adjustment',
  'supplier_delivery',
  'return_to_supplier',
  'write_off',
  'initial_stock'
);

-- ============================================================
-- USER PROFILES
-- ============================================================

CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'mechanic',
  phone         TEXT,
  hourly_rate   NUMERIC(10, 2),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- ============================================================
-- CUSTOMERS (Kund)
-- ============================================================

CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_company    BOOLEAN NOT NULL DEFAULT FALSE,
  first_name    TEXT,
  last_name     TEXT,
  personal_nr   TEXT,
  company_name  TEXT,
  org_nr        TEXT,
  email         TEXT,
  phone         TEXT,
  phone_alt     TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postal_code   TEXT,
  city          TEXT,
  country       TEXT NOT NULL DEFAULT 'SE',
  default_payment_terms_days INT NOT NULL DEFAULT 30,
  vat_exempt    BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_customer_identity CHECK (
    (is_company = TRUE AND company_name IS NOT NULL AND org_nr IS NOT NULL)
    OR
    (is_company = FALSE AND (first_name IS NOT NULL OR last_name IS NOT NULL))
  )
);

CREATE INDEX idx_customers_is_company ON customers(is_company);
CREATE INDEX idx_customers_org_nr ON customers(org_nr) WHERE org_nr IS NOT NULL;
CREATE INDEX idx_customers_personal_nr ON customers(personal_nr) WHERE personal_nr IS NOT NULL;
CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_fts ON customers
  USING GIN(to_tsvector('swedish',
    COALESCE(company_name, '') || ' ' ||
    COALESCE(first_name, '') || ' ' ||
    COALESCE(last_name, '') || ' ' ||
    COALESCE(email, '')
  ));

-- ============================================================
-- VEHICLES (Vagnkort)
-- ============================================================

CREATE TABLE vehicles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  reg_nr              TEXT NOT NULL UNIQUE,
  vin                 TEXT UNIQUE,
  brand               TEXT NOT NULL,
  model               TEXT NOT NULL,
  model_year          SMALLINT,
  color               TEXT,
  fuel_type           fuel_type,
  engine_size_cc      INT,
  power_kw            INT,
  transmission        TEXT,
  drive_type          TEXT,
  mileage_km          INT,
  mileage_updated_at  TIMESTAMPTZ,
  external_data       JSONB,
  external_fetched_at TIMESTAMPTZ,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_reg_nr ON vehicles(reg_nr);
CREATE INDEX idx_vehicles_vin ON vehicles(vin) WHERE vin IS NOT NULL;
CREATE INDEX idx_vehicles_brand_model ON vehicles(brand, model);

-- ============================================================
-- SUPPLIERS (Leverantör)
-- ============================================================

CREATE TABLE suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  org_nr          TEXT,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  address_line1   TEXT,
  postal_code     TEXT,
  city            TEXT,
  country         TEXT NOT NULL DEFAULT 'SE',
  integration_type TEXT,
  api_credentials JSONB,
  api_base_url    TEXT,
  default_lead_time_days INT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_integration_type ON suppliers(integration_type)
  WHERE integration_type IS NOT NULL;

-- ============================================================
-- PARTS & INVENTORY (Lager)
-- ============================================================

CREATE TABLE parts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  part_number     TEXT NOT NULL,
  internal_number TEXT,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  unit            TEXT NOT NULL DEFAULT 'pcs',
  cost_price      NUMERIC(12, 4) NOT NULL DEFAULT 0,
  sell_price      NUMERIC(12, 4) NOT NULL DEFAULT 0,
  markup_pct      NUMERIC(8, 4) GENERATED ALWAYS AS (
    CASE
      WHEN cost_price > 0
      THEN ((sell_price - cost_price) / cost_price) * 100
      ELSE 0
    END
  ) STORED,
  vat_rate_pct    NUMERIC(5, 2) NOT NULL DEFAULT 25.00,
  vmb_eligible    BOOLEAN NOT NULL DEFAULT FALSE,
  stock_qty       NUMERIC(12, 4) NOT NULL DEFAULT 0,
  stock_min_qty   NUMERIC(12, 4) NOT NULL DEFAULT 0,
  stock_location  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_parts_supplier_number UNIQUE (supplier_id, part_number)
);

CREATE INDEX idx_parts_supplier_id ON parts(supplier_id);
CREATE INDEX idx_parts_part_number ON parts(part_number);
CREATE INDEX idx_parts_internal_number ON parts(internal_number) WHERE internal_number IS NOT NULL;
CREATE INDEX idx_parts_low_stock ON parts(stock_qty, stock_min_qty) WHERE is_active = TRUE;
CREATE INDEX idx_parts_fts ON parts
  USING GIN(to_tsvector('swedish',
    COALESCE(name, '') || ' ' ||
    COALESCE(part_number, '') || ' ' ||
    COALESCE(internal_number, '') || ' ' ||
    COALESCE(description, '')
  ));

CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id         UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  work_order_id   UUID,
  user_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reason          stock_movement_reason NOT NULL,
  qty_change      NUMERIC(12, 4) NOT NULL,
  qty_before      NUMERIC(12, 4) NOT NULL,
  qty_after       NUMERIC(12, 4) NOT NULL,
  unit_cost       NUMERIC(12, 4),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_part_id ON stock_movements(part_id);
CREATE INDEX idx_stock_movements_work_order_id ON stock_movements(work_order_id)
  WHERE work_order_id IS NOT NULL;
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- ============================================================
-- INSPECTION TEMPLATES
-- ============================================================

CREATE TABLE inspection_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  template_data JSONB NOT NULL,
  vehicle_types TEXT[],
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RESOURCES (Liftar / Arbetsstationer)
-- ============================================================

CREATE TABLE resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'lift',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resources_is_active ON resources(is_active);

-- ============================================================
-- WORK ORDERS (Arbetsorder)
-- ============================================================

CREATE SEQUENCE work_order_seq START 1;

CREATE TABLE work_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          TEXT NOT NULL UNIQUE DEFAULT '',
  vehicle_id            UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status                work_order_status NOT NULL DEFAULT 'queued',
  received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promised_at           TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  mileage_in            INT,
  mileage_out           INT,
  customer_complaint    TEXT,
  internal_notes        TEXT,
  inspection_template_id UUID REFERENCES inspection_templates(id) ON DELETE SET NULL,
  invoice_id            UUID,
  labor_rate_override   NUMERIC(10, 2),
  created_by            UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_work_orders_vehicle_id ON work_orders(vehicle_id);
CREATE INDEX idx_work_orders_customer_id ON work_orders(customer_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_received_at ON work_orders(received_at DESC);
CREATE INDEX idx_work_orders_promised_at ON work_orders(promised_at) WHERE promised_at IS NOT NULL;
CREATE INDEX idx_work_orders_order_number ON work_orders(order_number);

CREATE TABLE work_order_mechanics (
  work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  mechanic_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_lead         BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (work_order_id, mechanic_id)
);

CREATE INDEX idx_wom_mechanic_id ON work_order_mechanics(mechanic_id);

CREATE TABLE work_order_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  assigned_to     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  estimated_hours NUMERIC(6, 2),
  actual_hours    NUMERIC(6, 2),
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wot_work_order_id ON work_order_tasks(work_order_id);
CREATE INDEX idx_wot_assigned_to ON work_order_tasks(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE TABLE work_order_parts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_id           UUID NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  quantity          NUMERIC(12, 4) NOT NULL,
  unit_cost_price   NUMERIC(12, 4) NOT NULL,
  unit_sell_price   NUMERIC(12, 4) NOT NULL,
  vmb_eligible      BOOLEAN NOT NULL DEFAULT FALSE,
  cost_basis        NUMERIC(12, 4),
  added_by          UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wop_work_order_id ON work_order_parts(work_order_id);
CREATE INDEX idx_wop_part_id ON work_order_parts(part_id);

CREATE TABLE inspection_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  template_item_id  TEXT NOT NULL,
  section_title     TEXT NOT NULL,
  item_label        TEXT NOT NULL,
  result_pass_fail  TEXT,
  result_value      NUMERIC(12, 4),
  result_note       TEXT,
  photo_urls        TEXT[],
  inspected_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  inspected_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inspection_result UNIQUE (work_order_id, template_item_id)
);

CREATE INDEX idx_inspection_results_work_order_id ON inspection_results(work_order_id);
CREATE INDEX idx_inspection_results_fail ON inspection_results(work_order_id)
  WHERE result_pass_fail = 'fail';

-- ============================================================
-- APPOINTMENTS (Bokningar)
-- ============================================================

CREATE TABLE appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id       UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  vehicle_id          UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  resource_id         UUID REFERENCES resources(id) ON DELETE SET NULL,
  mechanic_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ NOT NULL,
  source              TEXT NOT NULL DEFAULT 'internal',
  status              TEXT NOT NULL DEFAULT 'confirmed',
  service_description TEXT,
  customer_notes      TEXT,
  internal_notes      TEXT,
  created_by          UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_appointment_times CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_appointments_resource_id ON appointments(resource_id);
CREATE INDEX idx_appointments_mechanic_id ON appointments(mechanic_id);
CREATE INDEX idx_appointments_scheduled_start ON appointments(scheduled_start);
CREATE INDEX idx_appointments_work_order_id ON appointments(work_order_id)
  WHERE work_order_id IS NOT NULL;
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_date_range ON appointments(scheduled_start, scheduled_end);

-- Exclusion constraint: no two non-cancelled appointments on same resource at overlapping times
ALTER TABLE appointments ADD CONSTRAINT no_resource_overlap
  EXCLUDE USING GIST (
    resource_id WITH =,
    tstzrange(scheduled_start, scheduled_end) WITH &&
  )
  WHERE (status NOT IN ('cancelled') AND resource_id IS NOT NULL);

-- ============================================================
-- OPENING HOURS (Öppettider)
-- ============================================================

CREATE TABLE opening_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  open_time   TIME NOT NULL DEFAULT '08:00',
  close_time  TIME NOT NULL DEFAULT '17:00',
  is_closed   BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_opening_hours_day UNIQUE (day_of_week)
);

-- ============================================================
-- BLOCKED PERIODS (Manuella stängningar)
-- ============================================================

CREATE TABLE blocked_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  block_start   TIMESTAMPTZ NOT NULL,
  block_end     TIMESTAMPTZ NOT NULL,
  resource_id   UUID REFERENCES resources(id) ON DELETE CASCADE,
  mechanic_id   UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_block_times CHECK (block_end > block_start)
);

CREATE INDEX idx_blocked_periods_range ON blocked_periods(block_start, block_end);
CREATE INDEX idx_blocked_periods_resource ON blocked_periods(resource_id)
  WHERE resource_id IS NOT NULL;

-- ============================================================
-- API KEYS
-- ============================================================

CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,
  key_prefix      TEXT NOT NULL,
  allowed_origins TEXT[],
  scopes          TEXT[] NOT NULL DEFAULT ARRAY['booking:write'],
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BOOKING REQUEST LOG
-- ============================================================

CREATE TABLE booking_request_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL,
  origin          TEXT,
  ip_address      TEXT,
  api_key_id      UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  request_body    JSONB,
  response_status INT,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_log_created_at ON booking_request_log(created_at DESC);
CREATE INDEX idx_booking_log_api_key ON booking_request_log(api_key_id);

-- ============================================================
-- INVOICES & QUOTES (Faktura / Offert)
-- ============================================================

CREATE SEQUENCE invoice_seq START 1;
CREATE SEQUENCE quote_seq START 1;

CREATE TABLE invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number        TEXT UNIQUE,
  type                  invoice_type NOT NULL DEFAULT 'invoice',
  status                invoice_status NOT NULL DEFAULT 'draft',
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  work_order_id         UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  converted_from_quote_id UUID,
  invoice_date          DATE,
  due_date              DATE,
  subtotal_ex_vat       NUMERIC(14, 4) NOT NULL DEFAULT 0,
  vat_amount            NUMERIC(14, 4) NOT NULL DEFAULT 0,
  vmb_vat_amount        NUMERIC(14, 4) NOT NULL DEFAULT 0,
  total_inc_vat         NUMERIC(14, 4) NOT NULL DEFAULT 0,
  payment_terms_days    INT NOT NULL DEFAULT 30,
  paid_at               TIMESTAMPTZ,
  payment_method        TEXT,
  payment_reference     TEXT,
  sender_snapshot       JSONB,
  notes                 TEXT,
  created_by            UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_work_order_id ON invoices(work_order_id) WHERE work_order_id IS NOT NULL;
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status IN ('sent', 'overdue');
CREATE INDEX idx_invoices_type ON invoices(type);

CREATE TABLE invoice_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order        INT NOT NULL DEFAULT 0,
  line_type         invoice_line_type NOT NULL,
  part_id           UUID REFERENCES parts(id) ON DELETE SET NULL,
  work_order_task_id UUID REFERENCES work_order_tasks(id) ON DELETE SET NULL,
  description       TEXT NOT NULL,
  quantity          NUMERIC(12, 4) NOT NULL DEFAULT 1,
  unit              TEXT NOT NULL DEFAULT 'pcs',
  unit_price        NUMERIC(12, 4) NOT NULL,
  discount_pct      NUMERIC(5, 2) NOT NULL DEFAULT 0,
  line_total        NUMERIC(14, 4) GENERATED ALWAYS AS (
    quantity * unit_price * (1 - discount_pct / 100)
  ) STORED,
  vat_rate_pct      NUMERIC(5, 2) NOT NULL DEFAULT 25.00,
  vat_amount        NUMERIC(14, 4) GENERATED ALWAYS AS (
    CASE
      WHEN vmb_eligible = FALSE
      THEN quantity * unit_price * (1 - discount_pct / 100) * (vat_rate_pct / 100)
      ELSE 0
    END
  ) STORED,
  vmb_eligible      BOOLEAN NOT NULL DEFAULT FALSE,
  cost_basis        NUMERIC(12, 4),
  vmb_vat_amount    NUMERIC(14, 4) GENERATED ALWAYS AS (
    CASE
      WHEN vmb_eligible = TRUE AND cost_basis IS NOT NULL AND unit_price > cost_basis
      THEN (unit_price - cost_basis) * quantity * 0.20
      ELSE 0
    END
  ) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_part_id ON invoice_lines(part_id) WHERE part_id IS NOT NULL;

-- ============================================================
-- VAT SUMMARY VIEW
-- ============================================================

CREATE VIEW invoice_vat_summary AS
SELECT
  i.id AS invoice_id,
  i.invoice_number,
  i.customer_id,
  SUM(CASE WHEN il.vmb_eligible = FALSE THEN il.line_total ELSE 0 END)
    AS standard_subtotal_ex_vat,
  SUM(CASE WHEN il.vmb_eligible = FALSE THEN il.vat_amount ELSE 0 END)
    AS standard_vat_amount,
  SUM(CASE WHEN il.vmb_eligible = TRUE THEN il.line_total ELSE 0 END)
    AS vmb_subtotal_ex_vat,
  SUM(il.vmb_vat_amount) AS vmb_vat_amount,
  SUM(il.line_total) AS total_ex_vat,
  SUM(il.vat_amount) + SUM(il.vmb_vat_amount) AS total_vat,
  SUM(il.line_total) + SUM(il.vat_amount) + SUM(il.vmb_vat_amount) AS total_inc_vat
FROM invoices i
JOIN invoice_lines il ON il.invoice_id = i.id
GROUP BY i.id, i.invoice_number, i.customer_id;

-- ============================================================
-- DEFERRED FOREIGN KEYS (circular references)
-- ============================================================

ALTER TABLE work_orders ADD CONSTRAINT fk_work_order_invoice
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movement_work_order
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL;

ALTER TABLE invoices ADD CONSTRAINT fk_invoice_converted_from_quote
  FOREIGN KEY (converted_from_quote_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- ============================================================
-- Migration 0010: JM Assist v1.4.0
-- VHC (Vehicle Health Checks), CRM Reminders,
-- Part Price Searches, Media
-- ============================================================

-- ── 1. Vehicle Health Checks ──────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_health_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id         UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  vehicle_id            UUID NOT NULL REFERENCES vehicles(id),
  mechanic_id           UUID REFERENCES user_profiles(id),
  public_token          TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL DEFAULT 'draft',
  customer_notified_at  TIMESTAMPTZ,
  customer_approved_at  TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vhc_work_order ON vehicle_health_checks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_vhc_token ON vehicle_health_checks(public_token);

-- ── 2. VHC Items (traffic-light checklist items) ──────────────
CREATE TABLE IF NOT EXISTS vhc_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id          UUID NOT NULL REFERENCES vehicle_health_checks(id) ON DELETE CASCADE,
  category          TEXT NOT NULL,
  label             TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'green',
  comment           TEXT,
  estimated_cost    NUMERIC(10,2),
  customer_approved BOOLEAN DEFAULT false,
  media_urls        TEXT[],
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vhc_items_check ON vhc_items(check_id);

-- ── 3. CRM Reminders ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id    UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  due_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  approved_by   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_reminders_status ON crm_reminders(status);
CREATE INDEX IF NOT EXISTS idx_crm_reminders_due ON crm_reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_reminders_customer ON crm_reminders(customer_id);

-- ── 4. Part Price Searches ────────────────────────────────────
CREATE TABLE IF NOT EXISTS part_price_searches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id       UUID REFERENCES parts(id) ON DELETE CASCADE,
  search_query  TEXT NOT NULL,
  results       JSONB NOT NULL DEFAULT '[]'::jsonb,
  best_price    NUMERIC(12,4),
  best_margin   NUMERIC(12,4),
  searched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_search_part ON part_price_searches(part_id);

-- ── 5. Media (images/video) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  vhc_item_id     UUID REFERENCES vhc_items(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  file_path       TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_type       TEXT NOT NULL,
  file_size       INTEGER,
  thumbnail_path  TEXT,
  caption         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_work_order ON media(work_order_id);
CREATE INDEX IF NOT EXISTS idx_media_vhc_item ON media(vhc_item_id);

-- ── 6. Supabase Storage bucket ───────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('workshop-media', 'workshop-media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- ── 7. RLS Policies ──────────────────────────────────────────
ALTER TABLE vehicle_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vhc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_price_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (workshop staff)
CREATE POLICY "staff_vhc_all" ON vehicle_health_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_vhc_items_all" ON vhc_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_crm_all" ON crm_reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_prices_all" ON part_price_searches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_media_all" ON media FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anonymous read on VHC (for public checkup page via token)
CREATE POLICY "public_vhc_read" ON vehicle_health_checks FOR SELECT TO anon USING (true);
CREATE POLICY "public_vhc_items_read" ON vhc_items FOR SELECT TO anon USING (true);
CREATE POLICY "public_vhc_items_update" ON vhc_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_media_read" ON media FOR SELECT TO anon USING (true);

-- Storage policies
CREATE POLICY "staff_upload_media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workshop-media');
CREATE POLICY "public_read_media" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'workshop-media');
CREATE POLICY "staff_read_media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workshop-media');
CREATE POLICY "staff_delete_media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workshop-media');

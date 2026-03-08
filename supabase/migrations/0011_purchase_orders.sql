-- ============================================================
-- 0011: Purchase Orders & Lines
-- Tracks purchases from suppliers with full audit trail.
-- ============================================================

CREATE TABLE purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  work_order_id   UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'delivered',
  reference       TEXT,
  notes           TEXT,
  ordered_at      TIMESTAMPTZ DEFAULT now(),
  delivered_at    TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_order_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  part_id           UUID REFERENCES parts(id) ON DELETE SET NULL,
  part_number_raw   TEXT NOT NULL,
  part_name_raw     TEXT NOT NULL,
  quantity          NUMERIC(12, 4) NOT NULL,
  unit_cost_price   NUMERIC(12, 4) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_po_supplier     ON purchase_orders(supplier_id);
CREATE INDEX idx_po_work_order   ON purchase_orders(work_order_id);
CREATE INDEX idx_po_created_at   ON purchase_orders(created_at DESC);
CREATE INDEX idx_pol_po          ON purchase_order_lines(purchase_order_id);
CREATE INDEX idx_pol_part        ON purchase_order_lines(part_id);

-- Updated-at trigger (reuses existing function from 0003)
CREATE TRIGGER trg_updated_at_purchase_orders
  BEFORE UPDATE ON purchase_orders FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_orders_all_read" ON purchase_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "purchase_orders_all_write" ON purchase_orders
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "purchase_order_lines_all_read" ON purchase_order_lines
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "purchase_order_lines_all_write" ON purchase_order_lines
  FOR ALL USING (auth.uid() IS NOT NULL);

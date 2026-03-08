-- ============================================================
-- Migration: 0003_functions_triggers.sql
-- Database Functions and Triggers
-- ============================================================

-- ============================================================
-- updated_at auto-updater
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at_customers
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_vehicles
  BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_suppliers
  BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_parts
  BEFORE UPDATE ON parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_work_orders
  BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_work_order_tasks
  BEFORE UPDATE ON work_order_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_inspection_results
  BEFORE UPDATE ON inspection_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_inspection_templates
  BEFORE UPDATE ON inspection_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_resources
  BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_appointments
  BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_invoices
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_invoice_lines
  BEFORE UPDATE ON invoice_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Work Order number auto-generation
-- ============================================================

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'AO-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
      LPAD(NEXTVAL('work_order_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_work_order_number
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- ============================================================
-- Invoice / Quote number auto-generation
-- Only assigned when status changes from draft to something else
-- ============================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL AND NEW.status != 'draft' THEN
    IF NEW.type = 'invoice' THEN
      NEW.invoice_number := 'FAK-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
        LPAD(NEXTVAL('invoice_seq')::TEXT, 4, '0');
    ELSIF NEW.type = 'quote' THEN
      NEW.invoice_number := 'OFF-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
        LPAD(NEXTVAL('quote_seq')::TEXT, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_number
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();

-- ============================================================
-- Invoice totals sync
-- Recomputes stored totals on invoice whenever lines change
-- ============================================================

CREATE OR REPLACE FUNCTION sync_invoice_totals(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal      NUMERIC(14,4);
  v_vat           NUMERIC(14,4);
  v_vmb_vat       NUMERIC(14,4);
  v_total         NUMERIC(14,4);
BEGIN
  SELECT
    COALESCE(SUM(line_total), 0),
    COALESCE(SUM(vat_amount), 0),
    COALESCE(SUM(vmb_vat_amount), 0)
  INTO v_subtotal, v_vat, v_vmb_vat
  FROM invoice_lines
  WHERE invoice_id = p_invoice_id;

  v_total := v_subtotal + v_vat + v_vmb_vat;

  UPDATE invoices SET
    subtotal_ex_vat = v_subtotal,
    vat_amount      = v_vat,
    vmb_vat_amount  = v_vmb_vat,
    total_inc_vat   = v_total
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_sync_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_invoice_totals(OLD.invoice_id);
  ELSE
    PERFORM sync_invoice_totals(NEW.invoice_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_line_sync
  AFTER INSERT OR UPDATE OR DELETE ON invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_invoice_totals();

-- ============================================================
-- Stock movement on work_order_parts insert
-- Decrements stock and creates an audit record
-- ============================================================

CREATE OR REPLACE FUNCTION record_stock_movement_on_part_use()
RETURNS TRIGGER AS $$
DECLARE
  v_qty_before NUMERIC(12, 4);
BEGIN
  SELECT stock_qty INTO v_qty_before FROM parts WHERE id = NEW.part_id FOR UPDATE;

  INSERT INTO stock_movements (
    part_id, work_order_id, user_id, reason,
    qty_change, qty_before, qty_after, unit_cost
  ) VALUES (
    NEW.part_id, NEW.work_order_id, NEW.added_by, 'work_order_use',
    -NEW.quantity, v_qty_before, v_qty_before - NEW.quantity, NEW.unit_cost_price
  );

  UPDATE parts
    SET stock_qty = stock_qty - NEW.quantity,
        updated_at = NOW()
  WHERE id = NEW.part_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_on_part_use
  AFTER INSERT ON work_order_parts
  FOR EACH ROW EXECUTE FUNCTION record_stock_movement_on_part_use();

-- ============================================================
-- Work order status timestamp side-effects
-- ============================================================

CREATE OR REPLACE FUNCTION work_order_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ongoing' AND OLD.status != 'ongoing' AND NEW.started_at IS NULL THEN
    NEW.started_at := NOW();
  END IF;
  IF NEW.status = 'finished' AND OLD.status != 'finished' AND NEW.finished_at IS NULL THEN
    NEW.finished_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_work_order_status_timestamps
  BEFORE UPDATE OF status ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION work_order_status_timestamps();

-- ============================================================
-- User profile auto-create on auth.users insert
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Ny användare'),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'mechanic'::public.user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_create_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

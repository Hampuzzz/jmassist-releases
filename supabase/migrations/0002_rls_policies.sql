-- ============================================================
-- Migration: 0002_rls_policies.sql
-- Row Level Security Policies
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_request_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper: is current user an admin or receptionist
CREATE OR REPLACE FUNCTION is_admin_or_receptionist()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'receptionist')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- USER PROFILES
-- ============================================================

CREATE POLICY "user_profiles_own_read" ON user_profiles
  FOR SELECT USING (id = auth.uid() OR is_admin_or_receptionist());

CREATE POLICY "user_profiles_admin_write" ON user_profiles
  FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- CUSTOMERS, VEHICLES, SUPPLIERS
-- All authenticated users can read; admin/receptionist can write
-- ============================================================

CREATE POLICY "customers_all_read" ON customers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "customers_admin_write" ON customers
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "vehicles_all_read" ON vehicles
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vehicles_admin_write" ON vehicles
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "suppliers_all_read" ON suppliers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_admin_write" ON suppliers
  FOR ALL USING (is_admin_or_receptionist());

-- ============================================================
-- PARTS & STOCK
-- ============================================================

CREATE POLICY "parts_all_read" ON parts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "parts_admin_write" ON parts
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "stock_movements_all_read" ON stock_movements
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_movements_any_insert" ON stock_movements
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- WORK ORDERS
-- Mechanics see only orders assigned to them; admin/receptionist see all
-- ============================================================

CREATE POLICY "work_orders_mechanic_select" ON work_orders
  FOR SELECT USING (
    is_admin_or_receptionist()
    OR EXISTS (
      SELECT 1 FROM work_order_mechanics wom
      WHERE wom.work_order_id = work_orders.id
        AND wom.mechanic_id = auth.uid()
    )
  );

CREATE POLICY "work_orders_admin_write" ON work_orders
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "work_orders_mechanic_update" ON work_orders
  FOR UPDATE USING (
    get_user_role() = 'mechanic'
    AND EXISTS (
      SELECT 1 FROM work_order_mechanics wom
      WHERE wom.work_order_id = work_orders.id
        AND wom.mechanic_id = auth.uid()
    )
  );

CREATE POLICY "work_order_mechanics_all_read" ON work_order_mechanics
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "work_order_mechanics_admin_write" ON work_order_mechanics
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "work_order_tasks_read" ON work_order_tasks
  FOR SELECT USING (
    is_admin_or_receptionist()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM work_order_mechanics wom
      WHERE wom.work_order_id = work_order_tasks.work_order_id
        AND wom.mechanic_id = auth.uid()
    )
  );
CREATE POLICY "work_order_tasks_admin_write" ON work_order_tasks
  FOR ALL USING (is_admin_or_receptionist());
CREATE POLICY "work_order_tasks_mechanic_update" ON work_order_tasks
  FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "work_order_parts_read" ON work_order_parts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "work_order_parts_admin_write" ON work_order_parts
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "inspection_results_read" ON inspection_results
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "inspection_results_write" ON inspection_results
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "inspection_templates_read" ON inspection_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "inspection_templates_admin_write" ON inspection_templates
  FOR ALL USING (is_admin_or_receptionist());

-- ============================================================
-- SCHEDULING
-- ============================================================

CREATE POLICY "resources_all_read" ON resources
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "resources_admin_write" ON resources
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "appointments_read" ON appointments
  FOR SELECT USING (
    is_admin_or_receptionist()
    OR mechanic_id = auth.uid()
  );
CREATE POLICY "appointments_admin_write" ON appointments
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "opening_hours_all_read" ON opening_hours
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "opening_hours_admin_write" ON opening_hours
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "blocked_periods_all_read" ON blocked_periods
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "blocked_periods_admin_write" ON blocked_periods
  FOR ALL USING (is_admin_or_receptionist());

-- ============================================================
-- API KEYS & LOGS (admin only)
-- ============================================================

CREATE POLICY "api_keys_admin_only" ON api_keys
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "booking_log_admin_read" ON booking_request_log
  FOR SELECT USING (is_admin_or_receptionist());

-- ============================================================
-- INVOICES (admin and receptionist only; mechanics cannot see billing)
-- ============================================================

CREATE POLICY "invoices_admin_receptionist" ON invoices
  FOR ALL USING (is_admin_or_receptionist());

CREATE POLICY "invoice_lines_admin_receptionist" ON invoice_lines
  FOR ALL USING (is_admin_or_receptionist());

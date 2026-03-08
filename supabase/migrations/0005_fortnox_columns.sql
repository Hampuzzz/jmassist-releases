-- ============================================================
-- FORTNOX INTEGRATION COLUMNS
-- ============================================================

-- Add Fortnox sync columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS fortnox_id TEXT,
  ADD COLUMN IF NOT EXISTS fortnox_sync_status TEXT NOT NULL DEFAULT 'not_synced'
    CHECK (fortnox_sync_status IN ('not_synced', 'synced', 'error')),
  ADD COLUMN IF NOT EXISTS fortnox_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fortnox_error_msg TEXT;

-- Add Fortnox customer number to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS fortnox_customer_number TEXT;

-- Index for quick lookup of Fortnox-synced invoices
CREATE INDEX IF NOT EXISTS idx_invoices_fortnox_id ON invoices(fortnox_id) WHERE fortnox_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_fortnox_nr ON customers(fortnox_customer_number) WHERE fortnox_customer_number IS NOT NULL;

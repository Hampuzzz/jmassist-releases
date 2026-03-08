-- ============================================================
-- CUSTOMER APPROVAL SYSTEM
-- ============================================================

-- Approval request status
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'partially_approved', 'denied')),
  customer_message TEXT,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual items within an approval request
CREATE TABLE IF NOT EXISTS approval_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  inspection_result_id UUID REFERENCES inspection_results(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  estimated_cost NUMERIC(12, 2),
  photo_urls TEXT[],
  approved BOOLEAN,  -- NULL = pending, true/false = decided
  customer_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_work_order ON approval_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_token ON approval_requests(token);
CREATE INDEX IF NOT EXISTS idx_approval_items_request ON approval_items(approval_request_id);

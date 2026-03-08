-- Migration 0008: Expenses table for ekonomi module
-- Tracks fixed costs (rent, electricity, salary) and variable expenses

-- Category enum
DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM (
    'rent', 'electricity', 'salary', 'insurance', 'tools',
    'consumables', 'vehicle', 'marketing', 'software',
    'maintenance', 'accounting', 'telecom', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  category      expense_category NOT NULL,
  amount        NUMERIC(14,2) NOT NULL,
  vat_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_deductible BOOLEAN NOT NULL DEFAULT TRUE,
  supplier      TEXT,
  description   TEXT NOT NULL,
  is_recurring  BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_ref   TEXT,
  created_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for date-range queries (monthly/yearly filtering)
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);
CREATE INDEX IF NOT EXISTS idx_expenses_date_category ON expenses (date, category);

-- RLS: authenticated users can read/write expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY expenses_read ON expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY expenses_write ON expenses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY expenses_update ON expenses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY expenses_delete ON expenses
  FOR DELETE TO authenticated USING (true);

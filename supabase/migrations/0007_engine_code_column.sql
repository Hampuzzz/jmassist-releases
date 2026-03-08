-- Migration 0007: Add engine_code column to vehicles
-- Stores the extracted engine/motor code (e.g., D4204T14, N47D20, CJSA)

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_code TEXT;

-- Index for searching by engine code
CREATE INDEX IF NOT EXISTS idx_vehicles_engine_code ON vehicles (engine_code) WHERE engine_code IS NOT NULL;

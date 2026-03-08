-- Add power_hp (horsepower) column alongside power_kw
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS power_hp INTEGER;

-- Backfill existing kW values to HP (1 kW ≈ 1.341 HP)
UPDATE vehicles SET power_hp = ROUND(power_kw * 1.341) WHERE power_kw IS NOT NULL AND power_hp IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_power_hp ON vehicles(power_hp);

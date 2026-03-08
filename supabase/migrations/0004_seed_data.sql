-- ============================================================
-- Migration: 0004_seed_data.sql
-- Development seed data
-- ============================================================

-- ============================================================
-- Default opening hours (Mon-Fri 08:00-17:00, Sat-Sun closed)
-- ============================================================

INSERT INTO opening_hours (day_of_week, open_time, close_time, is_closed) VALUES
  (1, '08:00', '17:00', FALSE),  -- Måndag
  (2, '08:00', '17:00', FALSE),  -- Tisdag
  (3, '08:00', '17:00', FALSE),  -- Onsdag
  (4, '08:00', '17:00', FALSE),  -- Torsdag
  (5, '08:00', '16:00', FALSE),  -- Fredag
  (6, '09:00', '13:00', TRUE),   -- Lördag (stängd som standard)
  (7, '00:00', '00:00', TRUE)    -- Söndag (stängd)
ON CONFLICT (day_of_week) DO NOTHING;

-- ============================================================
-- Default resources (lifts)
-- ============================================================

INSERT INTO resources (name, resource_type, sort_order, notes) VALUES
  ('Lyft 1', 'lift', 1, 'Huvudlyft - personbilar upp till 3500 kg'),
  ('Lyft 2', 'lift', 2, 'Sekundärlyft - personbilar'),
  ('Smörjgrop', 'workstation', 3, 'Underhållsgrop'),
  ('Däckstation', 'workstation', 4, 'Däckbyte och balansering')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Default inspection template (60-punkts besiktning)
-- ============================================================

INSERT INTO inspection_templates (name, description, is_default, template_data) VALUES
(
  'Besiktning 60-punkt',
  'Standard 60-punkters genomgång för personbilar',
  TRUE,
  '{
    "sections": [
      {
        "title": "Bromsar",
        "items": [
          {"id": "brake_pad_front", "label": "Bromsbelägg fram", "type": "pass_fail"},
          {"id": "brake_pad_rear", "label": "Bromsbelägg bak", "type": "pass_fail"},
          {"id": "brake_disc_front", "label": "Bromsskiva fram (mm)", "type": "value", "unit": "mm"},
          {"id": "brake_disc_rear", "label": "Bromsskiva bak (mm)", "type": "value", "unit": "mm"},
          {"id": "brake_fluid", "label": "Bromsvätska", "type": "pass_fail"},
          {"id": "handbrake", "label": "Parkeringsbroms", "type": "pass_fail"}
        ]
      },
      {
        "title": "Olja och vätskor",
        "items": [
          {"id": "engine_oil", "label": "Motorolja - nivå och skick", "type": "pass_fail"},
          {"id": "coolant", "label": "Kylarvätska", "type": "pass_fail"},
          {"id": "power_steering_fluid", "label": "Servovätska", "type": "pass_fail"},
          {"id": "washer_fluid", "label": "Spolarvätska", "type": "pass_fail"}
        ]
      },
      {
        "title": "Däck och hjul",
        "items": [
          {"id": "tire_fl", "label": "Däckmönster FL (mm)", "type": "value", "unit": "mm"},
          {"id": "tire_fr", "label": "Däckmönster FR (mm)", "type": "value", "unit": "mm"},
          {"id": "tire_rl", "label": "Däckmönster RL (mm)", "type": "value", "unit": "mm"},
          {"id": "tire_rr", "label": "Däckmönster RR (mm)", "type": "value", "unit": "mm"},
          {"id": "tire_pressure_fl", "label": "Lufttryck FL (bar)", "type": "value", "unit": "bar"},
          {"id": "tire_pressure_fr", "label": "Lufttryck FR (bar)", "type": "value", "unit": "bar"},
          {"id": "tire_pressure_rl", "label": "Lufttryck RL (bar)", "type": "value", "unit": "bar"},
          {"id": "tire_pressure_rr", "label": "Lufttryck RR (bar)", "type": "value", "unit": "bar"},
          {"id": "wheel_bolts", "label": "Hjulbultar", "type": "pass_fail"}
        ]
      },
      {
        "title": "Belysning",
        "items": [
          {"id": "headlights", "label": "Strålkastare", "type": "pass_fail"},
          {"id": "tail_lights", "label": "Bakljus", "type": "pass_fail"},
          {"id": "brake_lights", "label": "Bromsljus", "type": "pass_fail"},
          {"id": "turn_signals", "label": "Blinkers", "type": "pass_fail"},
          {"id": "reverse_lights", "label": "Backljus", "type": "pass_fail"},
          {"id": "fog_lights", "label": "Dimljus", "type": "pass_fail"}
        ]
      },
      {
        "title": "Underrede",
        "items": [
          {"id": "rust_frame", "label": "Rostangrepp ram/bärare", "type": "pass_fail"},
          {"id": "shock_absorbers_front", "label": "Stötdämpare fram", "type": "pass_fail"},
          {"id": "shock_absorbers_rear", "label": "Stötdämpare bak", "type": "pass_fail"},
          {"id": "exhaust", "label": "Avgassystem", "type": "pass_fail"},
          {"id": "cv_boots", "label": "Dammskyddsmanschetter", "type": "pass_fail"},
          {"id": "tie_rods", "label": "Styrstagsändar", "type": "pass_fail"}
        ]
      },
      {
        "title": "Övrigt",
        "items": [
          {"id": "wiper_blades", "label": "Vindrutetorkare", "type": "pass_fail"},
          {"id": "battery", "label": "Batteri", "type": "pass_fail"},
          {"id": "air_filter", "label": "Luftfilter", "type": "pass_fail"},
          {"id": "cabin_filter", "label": "Kupéfilter", "type": "pass_fail"},
          {"id": "general_note", "label": "Övriga noteringar", "type": "note"}
        ]
      }
    ]
  }'::jsonb
);

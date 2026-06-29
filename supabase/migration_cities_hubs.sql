-- Migration: Add cities and hubs tables
-- Run this in Supabase SQL Editor if you already ran the original schema.sql

CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city_id, name)
);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read cities" ON cities;
DROP POLICY IF EXISTS "Allow public insert cities" ON cities;
DROP POLICY IF EXISTS "Allow public update cities" ON cities;
DROP POLICY IF EXISTS "Allow public delete cities" ON cities;

CREATE POLICY "Allow public read cities" ON cities FOR SELECT USING (true);
CREATE POLICY "Allow public insert cities" ON cities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update cities" ON cities FOR UPDATE USING (true);
CREATE POLICY "Allow public delete cities" ON cities FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read hubs" ON hubs;
DROP POLICY IF EXISTS "Allow public insert hubs" ON hubs;
DROP POLICY IF EXISTS "Allow public update hubs" ON hubs;
DROP POLICY IF EXISTS "Allow public delete hubs" ON hubs;

CREATE POLICY "Allow public read hubs" ON hubs FOR SELECT USING (true);
CREATE POLICY "Allow public insert hubs" ON hubs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update hubs" ON hubs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete hubs" ON hubs FOR DELETE USING (true);

-- Optional sample data
-- INSERT INTO cities (name) VALUES ('Colombo'), ('Kandy') ON CONFLICT (name) DO NOTHING;
-- INSERT INTO hubs (city_id, name)
--   SELECT c.id, h.name FROM cities c
--   CROSS JOIN (VALUES ('Hub A'), ('Hub B')) AS h(name)
--   WHERE c.name = 'Colombo'
-- ON CONFLICT DO NOTHING;

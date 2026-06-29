-- Vehicle Spare Parts Inventory - Full Supabase Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard

-- Cities (one city can have multiple hubs)
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hubs (belong to a city — e.g. Colombo → Hub A, Hub B, Hub C)
CREATE TABLE IF NOT EXISTS hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city_id, name)
);

-- Inventory table (stock per hub)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  item_description TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  city TEXT NOT NULL,
  hub_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_code, hub_name)
);

-- Master list of allowed vehicle numbers
CREATE TABLE IF NOT EXISTS vehicle_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage / deduction history (from Android app)
CREATE TABLE IF NOT EXISTS usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_code TEXT NOT NULL,
  item_description TEXT NOT NULL,
  hub_name TEXT NOT NULL,
  city TEXT,
  qty_used INTEGER NOT NULL CHECK (qty_used > 0),
  qty_before INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  vehicle_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on inventory changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_vehicle(p TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN upper(regexp_replace(trim(p), '[\s\-]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Validate vehicle against master list
CREATE OR REPLACE FUNCTION validate_vehicle(p_vehicle_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM vehicle_master
    WHERE normalize_vehicle(vehicle_number) = normalize_vehicle(p_vehicle_number)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Deduct stock atomically (called from Android app)
CREATE OR REPLACE FUNCTION deduct_stock(
  p_item_code TEXT,
  p_hub_name TEXT,
  p_qty_used INTEGER,
  p_vehicle_number TEXT
)
RETURNS JSON AS $$
DECLARE
  v_item inventory%ROWTYPE;
  v_new_qty INTEGER;
  v_vehicle TEXT;
BEGIN
  IF p_qty_used <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;

  v_vehicle := normalize_vehicle(p_vehicle_number);

  IF v_vehicle = '' OR length(v_vehicle) <= 9 THEN
    RAISE EXCEPTION 'Vehicle number must be at least 10 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vehicle_master
    WHERE normalize_vehicle(vehicle_number) = v_vehicle
  ) THEN
    RAISE EXCEPTION 'Vehicle number not registered in master list';
  END IF;

  SELECT * INTO v_item
  FROM inventory
  WHERE item_code = p_item_code AND hub_name = p_hub_name
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found in this hub';
  END IF;

  IF v_item.qty < p_qty_used THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %', v_item.qty;
  END IF;

  v_new_qty := v_item.qty - p_qty_used;

  UPDATE inventory SET qty = v_new_qty WHERE id = v_item.id;

  INSERT INTO usage_history (
    inventory_id, item_code, item_description, hub_name, city,
    qty_used, qty_before, qty_after, vehicle_number
  ) VALUES (
    v_item.id, v_item.item_code, v_item.item_description, v_item.hub_name, v_item.city,
    p_qty_used, v_item.qty, v_new_qty, v_vehicle
  );

  RETURN json_build_object(
    'success', true,
    'qty_after', v_new_qty,
    'item_code', v_item.item_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read cities" ON cities FOR SELECT USING (true);
CREATE POLICY "Allow public insert cities" ON cities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update cities" ON cities FOR UPDATE USING (true);
CREATE POLICY "Allow public delete cities" ON cities FOR DELETE USING (true);

CREATE POLICY "Allow public read hubs" ON hubs FOR SELECT USING (true);
CREATE POLICY "Allow public insert hubs" ON hubs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update hubs" ON hubs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete hubs" ON hubs FOR DELETE USING (true);

CREATE POLICY "Allow public read vehicle_master" ON vehicle_master FOR SELECT USING (true);
CREATE POLICY "Allow public insert vehicle_master" ON vehicle_master FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update vehicle_master" ON vehicle_master FOR UPDATE USING (true);
CREATE POLICY "Allow public delete vehicle_master" ON vehicle_master FOR DELETE USING (true);

CREATE POLICY "Allow public read inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "Allow public insert inventory" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update inventory" ON inventory FOR UPDATE USING (true);
CREATE POLICY "Allow public delete inventory" ON inventory FOR DELETE USING (true);

CREATE POLICY "Allow public read history" ON usage_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert history" ON usage_history FOR INSERT WITH CHECK (true);

GRANT EXECUTE ON FUNCTION validate_vehicle TO anon, authenticated;
GRANT EXECUTE ON FUNCTION deduct_stock TO anon, authenticated;

-- Migration: vehicle_master table + validation in deduct_stock
-- Run in Supabase SQL Editor

-- Normalize vehicle number (uppercase, no spaces/dashes)
CREATE OR REPLACE FUNCTION normalize_vehicle(p TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN upper(regexp_replace(trim(p), '[\s\-]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Master list of allowed vehicle numbers
CREATE TABLE IF NOT EXISTS vehicle_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_master_normalized
  ON vehicle_master (normalize_vehicle(vehicle_number));

ALTER TABLE vehicle_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read vehicle_master" ON vehicle_master;
DROP POLICY IF EXISTS "Allow public insert vehicle_master" ON vehicle_master;
DROP POLICY IF EXISTS "Allow public update vehicle_master" ON vehicle_master;
DROP POLICY IF EXISTS "Allow public delete vehicle_master" ON vehicle_master;

CREATE POLICY "Allow public read vehicle_master" ON vehicle_master FOR SELECT USING (true);
CREATE POLICY "Allow public insert vehicle_master" ON vehicle_master FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update vehicle_master" ON vehicle_master FOR UPDATE USING (true);
CREATE POLICY "Allow public delete vehicle_master" ON vehicle_master FOR DELETE USING (true);

-- Check if vehicle exists in master (for Android app)
CREATE OR REPLACE FUNCTION validate_vehicle(p_vehicle_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM vehicle_master
    WHERE normalize_vehicle(vehicle_number) = normalize_vehicle(p_vehicle_number)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION validate_vehicle TO anon, authenticated;

-- Update deduct_stock to require vehicle in master
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

GRANT EXECUTE ON FUNCTION deduct_stock TO anon, authenticated;

-- Reload Supabase API schema cache
NOTIFY pgrst, 'reload schema';

-- Sample vehicles (optional)
-- INSERT INTO vehicle_master (vehicle_number) VALUES ('TN24PL5642') ON CONFLICT DO NOTHING;

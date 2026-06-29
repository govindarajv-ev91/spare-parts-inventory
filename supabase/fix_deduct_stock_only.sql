-- Run this in Supabase SQL Editor to fix deduct_stock for your vehicle_master table
-- (table with vehicle_number column only — no is_active)

CREATE OR REPLACE FUNCTION public.normalize_vehicle(p TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN upper(regexp_replace(trim(p), '[\s\-]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.deduct_stock(
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

  v_vehicle := public.normalize_vehicle(p_vehicle_number);

  IF v_vehicle = '' OR length(v_vehicle) <= 9 THEN
    RAISE EXCEPTION 'Vehicle number must be at least 10 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vehicle_master
    WHERE public.normalize_vehicle(vehicle_number) = v_vehicle
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

GRANT EXECUTE ON FUNCTION public.deduct_stock(TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

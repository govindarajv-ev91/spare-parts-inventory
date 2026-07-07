-- Add OEM / vehicle brand name to inventory and stock requests
-- Run in Supabase SQL Editor

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS oem_name TEXT NOT NULL DEFAULT '';

ALTER TABLE public.stock_request_items
  ADD COLUMN IF NOT EXISTS oem_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_inventory_oem_name
  ON public.inventory (oem_name);

-- Update approve function to save OEM name
CREATE OR REPLACE FUNCTION public.approve_stock_request(p_request_id UUID)
RETURNS JSON AS $$
DECLARE
  v_req public.stock_requests%ROWTYPE;
  v_item public.stock_request_items%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_req
  FROM public.stock_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is already %', v_req.status;
  END IF;

  FOR v_item IN
    SELECT * FROM public.stock_request_items WHERE request_id = p_request_id
  LOOP
    INSERT INTO public.inventory (
      item_code, item_description, oem_name, qty, city, hub_name
    ) VALUES (
      v_item.item_code, v_item.item_description, COALESCE(v_item.oem_name, ''),
      v_item.qty, v_item.city, v_item.hub_name
    )
    ON CONFLICT (item_code, hub_name) DO UPDATE SET
      item_description = EXCLUDED.item_description,
      oem_name = EXCLUDED.oem_name,
      qty = public.inventory.qty + EXCLUDED.qty,
      city = EXCLUDED.city,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.stock_requests
  SET
    status = 'approved',
    reviewed_by = 'Admin',
    reviewed_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'items_applied', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

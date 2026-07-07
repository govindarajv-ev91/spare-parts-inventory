-- Hub login passwords + stock approval workflow
-- Run in Supabase SQL Editor

-- 1. Password on hubs (for hub-wise web login)
ALTER TABLE public.hubs
  ADD COLUMN IF NOT EXISTS password TEXT;

-- Optional: set passwords for existing hubs (change these)
-- UPDATE public.hubs SET password = 'hub123' WHERE password IS NULL;

-- 2. Stock requests (pending admin approval)
CREATE TABLE IF NOT EXISTS public.stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('manual', 'bulk')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  hub_id UUID REFERENCES public.hubs(id) ON DELETE SET NULL,
  hub_name TEXT NOT NULL,
  city TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  invoice_path TEXT,
  invoice_name TEXT,
  notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.stock_requests(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  item_description TEXT NOT NULL,
  oem_name TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL CHECK (qty >= 0),
  city TEXT NOT NULL,
  hub_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_requests_status
  ON public.stock_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_request_items_request
  ON public.stock_request_items (request_id);

ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read stock_requests" ON public.stock_requests;
DROP POLICY IF EXISTS "Allow public insert stock_requests" ON public.stock_requests;
DROP POLICY IF EXISTS "Allow public update stock_requests" ON public.stock_requests;
DROP POLICY IF EXISTS "Allow public read stock_request_items" ON public.stock_request_items;
DROP POLICY IF EXISTS "Allow public insert stock_request_items" ON public.stock_request_items;

CREATE POLICY "Allow public read stock_requests"
  ON public.stock_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock_requests"
  ON public.stock_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stock_requests"
  ON public.stock_requests FOR UPDATE USING (true);

CREATE POLICY "Allow public read stock_request_items"
  ON public.stock_request_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock_request_items"
  ON public.stock_request_items FOR INSERT WITH CHECK (true);

-- 3. Approve request: apply items to inventory, mark approved
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

CREATE OR REPLACE FUNCTION public.reject_stock_request(
  p_request_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_req public.stock_requests%ROWTYPE;
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

  UPDATE public.stock_requests
  SET
    status = 'rejected',
    reviewed_by = 'Admin',
    reviewed_at = now(),
    reject_reason = p_reason
  WHERE id = p_request_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.approve_stock_request(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_stock_request(UUID, TEXT) TO anon, authenticated;

-- 4. Storage bucket for invoice / document attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('stock-invoices', 'stock-invoices', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read stock invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload stock invoices" ON storage.objects;

CREATE POLICY "Allow public read stock invoices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stock-invoices');

CREATE POLICY "Allow public upload stock invoices"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stock-invoices');

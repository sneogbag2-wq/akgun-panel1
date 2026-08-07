-- Paket 06A: Ticari Stok Yükleme ve Rapor Modülü
-- Migration: 39_commercial_stock

CREATE TABLE IF NOT EXISTS public.commercial_stock_import (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_remaining_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PUBLISHED',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commercial_stock_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.commercial_stock_import(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    remaining_quantity NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.commercial_stock_item ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.commercial_stock_item ADD COLUMN IF NOT EXISTS product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_comm_stock_customer ON public.commercial_stock_item(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_stock_product ON public.commercial_stock_item(product_id);


ALTER TABLE public.commercial_stock_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_stock_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for commercial_stock_import" ON public.commercial_stock_import;
CREATE POLICY "Allow authenticated read for commercial_stock_import" ON public.commercial_stock_import FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for commercial_stock_item" ON public.commercial_stock_item;
CREATE POLICY "Allow authenticated read for commercial_stock_item" ON public.commercial_stock_item FOR SELECT USING (true);


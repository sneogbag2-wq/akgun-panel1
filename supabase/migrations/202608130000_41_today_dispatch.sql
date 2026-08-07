-- Paket 07B: Bugünkü Sevkiyat Takip
-- Migration: 41_today_dispatch

CREATE TABLE IF NOT EXISTS public.dispatch_today_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    as_of_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispatch_order_card (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    view_class TEXT NOT NULL DEFAULT 'SIPARIS', -- 'SIPARIS', 'EMANET_SP'
    operational_state TEXT NOT NULL DEFAULT 'ACTION_NOW', -- 'ACTION_NOW', 'IN_TRANSIT', 'COMPLETED', 'DEFERRED'
    document_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    document_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_card_date ON public.dispatch_order_card(as_of_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_card_class ON public.dispatch_order_card(view_class);

ALTER TABLE public.dispatch_today_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_order_card ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for dispatch_today_summary" ON public.dispatch_today_summary;
CREATE POLICY "Allow authenticated read for dispatch_today_summary" ON public.dispatch_today_summary FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for dispatch_order_card" ON public.dispatch_order_card;
CREATE POLICY "Allow authenticated read for dispatch_order_card" ON public.dispatch_order_card FOR SELECT USING (true);


-- Paket 07A: Sipariş / Teslimat Belge Omurgası
-- Migration: 40_sales_orders

CREATE TABLE IF NOT EXISTS public.sales_order_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_document_no TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    requested_delivery_date DATE,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    order_status TEXT NOT NULL DEFAULT 'SUBMITTED', -- 'SUBMITTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_order_source_row (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.sales_order_document(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sales_order_document ADD COLUMN IF NOT EXISTS sales_document_no TEXT;
ALTER TABLE public.sales_order_document ADD COLUMN IF NOT EXISTS customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_order_doc_no_v2 ON public.sales_order_document(sales_document_no);
CREATE INDEX IF NOT EXISTS idx_sales_order_customer_v2 ON public.sales_order_document(customer_id);


ALTER TABLE public.sales_order_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_source_row ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for sales_order_document" ON public.sales_order_document;
CREATE POLICY "Allow authenticated read for sales_order_document" ON public.sales_order_document FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for sales_order_source_row" ON public.sales_order_source_row;
CREATE POLICY "Allow authenticated read for sales_order_source_row" ON public.sales_order_source_row FOR SELECT USING (true);


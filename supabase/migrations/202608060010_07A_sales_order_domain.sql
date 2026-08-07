-- ==============================================================================
-- Paket 07A & 07B: Sipariş/Teslimat Belge Omurgası ve Bugünkü Sevkiyat Takip
-- ==============================================================================

-- 1) sales_order_import_check Tablosu (Aktif snapshot kontrolü)
CREATE TABLE IF NOT EXISTS public.sales_order_import_check (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT single_active_sales_order UNIQUE (is_active)
);

-- 2) sales_order_document Tablosu (Belge başlığı, tekilleştirilmiş)
CREATE TABLE IF NOT EXISTS public.sales_order_document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES public.sales_order_import_check(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_no TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    document_type TEXT NOT NULL,
    delivery_date DATE,
    operational_state TEXT NOT NULL CHECK (operational_state IN ('ACTION_NOW', 'IN_TRANSIT', 'COMPLETED', 'DEFERRED', 'EXCLUDED', 'BLOCKED_DATA', 'MIXED_REVIEW')),
    view_class TEXT NOT NULL CHECK (view_class IN ('SIPARIS', 'EMANET_SP')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3) sales_order_source_row Tablosu (Kaynak satırların ham detayları)
CREATE TABLE IF NOT EXISTS public.sales_order_source_row (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.sales_order_document(id) ON DELETE CASCADE,
    raw_material_no TEXT,
    raw_quantity NUMERIC,
    raw_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4) sales_order_status_observation Tablosu (Durum tarihçesi/gözlemleri)
CREATE TABLE IF NOT EXISTS public.sales_order_status_observation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.sales_order_document(id) ON DELETE CASCADE,
    observed_status TEXT NOT NULL,
    observation_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5) sales_order_invoice_link Tablosu (Fatura - Sipariş bağı)
CREATE TABLE IF NOT EXISTS public.sales_order_invoice_link (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.sales_order_document(id) ON DELETE CASCADE,
    invoice_no TEXT,
    link_status TEXT NOT NULL CHECK (link_status IN ('CONFIRMED_DUAL_KEY', 'CONFIRMED_SINGLE_KEY', 'DELIVERED_WITHOUT_INVOICE_REFERENCE', 'INVOICE_ORDER_KEY_CONFLICT', 'AMBIGUOUS')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- İndeksler
CREATE INDEX idx_sales_order_doc_import ON public.sales_order_document(import_id);
CREATE INDEX idx_sales_order_doc_no ON public.sales_order_document(document_no);
CREATE INDEX idx_sales_order_customer ON public.sales_order_document(customer_no);

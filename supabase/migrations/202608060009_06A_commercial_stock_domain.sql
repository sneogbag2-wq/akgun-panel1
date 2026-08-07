-- ==============================================================================
-- Paket 06A: Ticari Stok Yükleme ve Raporlama Domain'i
-- ==============================================================================

-- 1) commercial_stock_import Tablosu
CREATE TABLE IF NOT EXISTS public.commercial_stock_import (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_filename TEXT NOT NULL,
    upload_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    uploaded_by UUID NOT NULL, -- references auth.users
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'VALIDATED', 'PUBLISHED', 'FAILED', 'REJECTED')),
    row_count INTEGER NOT NULL DEFAULT 0,
    validation_error_summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2) commercial_stock_item Tablosu
CREATE TABLE IF NOT EXISTS public.commercial_stock_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES public.commercial_stock_import(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_no TEXT NOT NULL,
    material_no TEXT NOT NULL,
    remaining_quantity NUMERIC NOT NULL,
    remaining_litres NUMERIC NOT NULL,
    -- Orijinal metin verileri (denetim izi için)
    raw_customer_text TEXT,
    raw_material_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3) commercial_stock_import_check (Tekil aktif kısıtı)
CREATE TABLE IF NOT EXISTS public.commercial_stock_import_check (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES public.commercial_stock_import(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT single_active_commercial_stock UNIQUE (is_active)
);

-- İndeksler
CREATE INDEX idx_com_stock_item_import ON public.commercial_stock_item(import_id);
CREATE INDEX idx_com_stock_item_customer ON public.commercial_stock_item(customer_no);
CREATE INDEX idx_com_stock_item_material ON public.commercial_stock_item(material_no);

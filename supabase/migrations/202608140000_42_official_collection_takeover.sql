-- Paket 08A: Resmî Tahsilatın Belgeler Katmanını Devralması
-- Migration: 42_official_collection_takeover

CREATE TABLE IF NOT EXISTS public.official_collection_takeover (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    official_collection_id TEXT NOT NULL,
    transient_document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    match_status TEXT NOT NULL DEFAULT 'RECONCILED', -- 'RECONCILED', 'LOW_MATCH_REVIEW'
    batch_match_rate NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeover_doc ON public.official_collection_takeover(transient_document_no);
CREATE INDEX IF NOT EXISTS idx_takeover_customer ON public.official_collection_takeover(customer_id);

ALTER TABLE public.official_collection_takeover ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for official_collection_takeover" ON public.official_collection_takeover;
CREATE POLICY "Allow authenticated read for official_collection_takeover" ON public.official_collection_takeover FOR SELECT USING (true);


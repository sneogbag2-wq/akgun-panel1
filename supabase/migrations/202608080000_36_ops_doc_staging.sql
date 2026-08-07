-- Paket 01A: Geçici Belgeler Staging ve Snapshot Yenileme
-- Migration: 36_ops_doc_staging

CREATE TABLE IF NOT EXISTS public.ops_doc_staging_import (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'BELGELER_EXCEL',
    row_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'STAGED', -- 'STAGED', 'PUBLISHED', 'FAILED'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_doc_staging_row (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staging_id UUID NOT NULL REFERENCES public.ops_doc_staging_import(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    document_date DATE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    dedup_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'VALID'
);

CREATE TABLE IF NOT EXISTS public.ops_doc_transient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    document_date DATE,
    snapshot_version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ops_doc_transient ADD COLUMN IF NOT EXISTS snapshot_version INTEGER DEFAULT 1;
ALTER TABLE public.ops_doc_transient ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.ops_doc_transient ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ops_doc_staging_row_id ON public.ops_doc_staging_row(staging_id);
CREATE INDEX IF NOT EXISTS idx_ops_doc_transient_doc ON public.ops_doc_transient(document_no);


ALTER TABLE public.ops_doc_staging_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_doc_staging_row ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_doc_transient ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for ops_doc_staging_import" ON public.ops_doc_staging_import;
CREATE POLICY "Allow authenticated read for ops_doc_staging_import" ON public.ops_doc_staging_import FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for ops_doc_staging_row" ON public.ops_doc_staging_row;
CREATE POLICY "Allow authenticated read for ops_doc_staging_row" ON public.ops_doc_staging_row FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for ops_doc_transient" ON public.ops_doc_transient;
CREATE POLICY "Allow authenticated read for ops_doc_transient" ON public.ops_doc_transient FOR SELECT USING (true);


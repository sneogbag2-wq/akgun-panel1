-- Paket 04A: ST Tahsilat / Litre Günlük Eşleştirme
-- Migration: 37_stl_day_pairs

CREATE TABLE IF NOT EXISTS public.stl_daily_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sellout_date DATE NOT NULL,
    collection_dates DATE[] NOT NULL,
    sellout_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    operational_collection_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tl_per_litre NUMERIC(15, 4) NOT NULL DEFAULT 0,
    coverage_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    overlap_warning BOOLEAN NOT NULL DEFAULT false,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stl_matched_signal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stl_result_id UUID REFERENCES public.stl_daily_results(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    match_rule TEXT NOT NULL, -- 'D_MINUS_1', 'MONDAY_WEEKEND_COMBINED', 'MONTH_END_SUNDAY'
    calculated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS stl_result_id UUID REFERENCES public.stl_daily_results(id) ON DELETE CASCADE;
ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS document_no TEXT;
ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS match_rule TEXT;

CREATE INDEX IF NOT EXISTS idx_stl_daily_date ON public.stl_daily_results(sellout_date);
CREATE INDEX IF NOT EXISTS idx_stl_matched_result ON public.stl_matched_signal(stl_result_id);


ALTER TABLE public.stl_daily_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stl_matched_signal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for stl_daily_results" ON public.stl_daily_results;
CREATE POLICY "Allow authenticated read for stl_daily_results" ON public.stl_daily_results FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for stl_matched_signal" ON public.stl_matched_signal;
CREATE POLICY "Allow authenticated read for stl_matched_signal" ON public.stl_matched_signal FOR SELECT USING (true);


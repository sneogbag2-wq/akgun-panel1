-- Paket 04B: Sellout Tarihsel Karşılaştırma ve AI Raporlama
-- Migration: 38_sellout_historical_analysis

CREATE TABLE IF NOT EXISTS public.sellout_historical_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period TEXT NOT NULL, -- Örn: '2026-07'
    channel TEXT NOT NULL DEFAULT 'ALL',
    open_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    closed_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    mom_growth NUMERIC(7, 2) NOT NULL DEFAULT 0,
    yoy_growth NUMERIC(7, 2) NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sellout_hist_period ON public.sellout_historical_snapshots(period);

ALTER TABLE public.sellout_historical_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for sellout_historical_snapshots" ON public.sellout_historical_snapshots;
CREATE POLICY "Allow authenticated read for sellout_historical_snapshots" ON public.sellout_historical_snapshots FOR SELECT USING (true);


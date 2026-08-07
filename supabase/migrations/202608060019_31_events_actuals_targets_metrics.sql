-- Migration: 31_events_actuals_targets_metrics
-- Description: Events (EVT), Actuals (ACT), and Targets (TGT) metrics implementation.

-- EVT-001..009: Kanonik Olaylar ve Satır Çözümlemeleri
CREATE TABLE IF NOT EXISTS public.evt_sellout_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    document_id TEXT NOT NULL,
    line_identity_hash TEXT NOT NULL,       -- EVT-007
    billing_date TIMESTAMPTZ NOT NULL,      -- EVT-001
    movement_type TEXT NOT NULL,            -- EVT-003
    is_duplicate BOOLEAN DEFAULT false,     -- EVT-006
    cancellation_ref_id UUID,               -- EVT-004
    responsibility_status TEXT NOT NULL,    -- EVT-009
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ACT-001..013: Gerçekleşen Metrikler (Net, Brüt, İade)
CREATE TABLE IF NOT EXISTS public.act_metric_actual (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    gross_sales_litres NUMERIC(15, 2),      -- ACT-001
    return_litres NUMERIC(15, 2),           -- ACT-002
    reversal_effect_litres NUMERIC(15, 2),  -- ACT-003
    net_sales_litres NUMERIC(15, 2),        -- ACT-004
    return_rate NUMERIC(5, 4),              -- ACT-005
    unique_documents INTEGER,               -- ACT-006
    unique_buying_customers INTEGER,        -- ACT-007
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- TGT-001..008: Hedef ve Gerçekleşme Kıyaslamaları (Attainment)
CREATE TABLE IF NOT EXISTS public.tgt_performance_attainment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    target_litres NUMERIC(15, 2),           -- TGT-001
    actual_litres NUMERIC(15, 2),           -- TGT-002
    attainment_rate NUMERIC(5, 4),          -- TGT-003
    remaining_target NUMERIC(15, 2),        -- TGT-004
    historical_share NUMERIC(5, 4),         -- TGT-005
    monthly_performance_status TEXT,        -- TGT-008
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evt_sellout_calc_run ON public.evt_sellout_event(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_act_metric_calc_run ON public.act_metric_actual(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_tgt_performance_calc_run ON public.tgt_performance_attainment(calculation_run_id);

-- Enable RLS
ALTER TABLE public.evt_sellout_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.act_metric_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tgt_performance_attainment ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for evt_sellout_event" ON public.evt_sellout_event FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for act_metric_actual" ON public.act_metric_actual FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for tgt_performance_attainment" ON public.tgt_performance_attainment FOR SELECT USING (true);

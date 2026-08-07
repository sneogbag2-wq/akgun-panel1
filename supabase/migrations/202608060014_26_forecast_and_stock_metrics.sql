-- Migration: 26_forecast_and_stock_metrics
-- Description: Dynamic Forecast (FCST) and Advanced Stock (SS, RISK, REQ, ORD) metrics implementation.

-- FCST-001: daily_forecast_model
CREATE TABLE IF NOT EXISTS public.fcst_daily_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_version_id UUID NOT NULL,
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    forecast_date TIMESTAMPTZ NOT NULL,
    predicted_value NUMERIC(15, 2),
    lower_bound_p25 NUMERIC(15, 2),
    upper_bound_p75 NUMERIC(15, 2),
    model_confidence TEXT NOT NULL,
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- SS-001: dynamic_safety_stock
CREATE TABLE IF NOT EXISTS public.ss_dynamic_safety_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_version_id UUID NOT NULL,
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    recommended_safety_stock NUMERIC(15, 2),
    lead_time_days INTEGER,
    service_level_target NUMERIC(5, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- RISK-001: stockout_risk_indicator
CREATE TABLE IF NOT EXISTS public.risk_stockout_indicator (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    stockout_probability NUMERIC(5, 2),
    expected_shortage_units NUMERIC(15, 2),
    days_to_stockout INTEGER,
    risk_severity TEXT NOT NULL,
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ORD-001: automated_replenishment_order
CREATE TABLE IF NOT EXISTS public.ord_replenishment_recommendation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    recommended_order_qty NUMERIC(15, 2),
    estimated_cost NUMERIC(15, 2),
    action_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Index creation for faster queries
CREATE INDEX IF NOT EXISTS idx_fcst_model_calc_run ON public.fcst_daily_model(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_ss_safety_calc_run ON public.ss_dynamic_safety_stock(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_risk_stockout_calc_run ON public.risk_stockout_indicator(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_ord_replenish_calc_run ON public.ord_replenishment_recommendation(calculation_run_id);

-- Enable RLS
ALTER TABLE public.fcst_daily_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_dynamic_safety_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_stockout_indicator ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ord_replenishment_recommendation ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for fcst_daily_model" ON public.fcst_daily_model FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for ss_dynamic_safety_stock" ON public.ss_dynamic_safety_stock FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for risk_stockout_indicator" ON public.risk_stockout_indicator FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for ord_replenishment_recommendation" ON public.ord_replenishment_recommendation FOR SELECT USING (true);

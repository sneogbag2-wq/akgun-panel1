-- Migration: 25_advanced_financial_metrics
-- Description: Advanced Financial Analytics (FAN) and missing FIN metrics implementation.

-- FAN-001: concentration_pareto_hhi
CREATE TABLE IF NOT EXISTS public.fan_concentration_pareto_hhi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_version_id UUID NOT NULL,
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    dimension_keys JSONB NOT NULL,
    value_numeric NUMERIC(15, 2),
    value_text TEXT,
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- FAN-002: aging_migration_matrix
CREATE TABLE IF NOT EXISTS public.fan_aging_migration_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_version_id UUID NOT NULL,
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    from_bucket TEXT NOT NULL,
    to_bucket TEXT NOT NULL,
    migrated_amount NUMERIC(15, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- FAN-003: invoice_vintage_curve
CREATE TABLE IF NOT EXISTS public.fan_invoice_vintage_curve (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    vintage_day_7_rate NUMERIC(5, 2),
    vintage_day_14_rate NUMERIC(5, 2),
    vintage_day_21_rate NUMERIC(5, 2),
    vintage_day_28_rate NUMERIC(5, 2),
    vintage_day_45_rate NUMERIC(5, 2),
    vintage_day_60_rate NUMERIC(5, 2),
    vintage_day_90_rate NUMERIC(5, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- FAN-016: stress_scenario
CREATE TABLE IF NOT EXISTS public.fan_stress_scenario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    scenario_id TEXT NOT NULL,
    dimension_keys JSONB NOT NULL,
    impact_4_week NUMERIC(15, 2),
    impact_13_week NUMERIC(15, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Index creation for faster queries
CREATE INDEX IF NOT EXISTS idx_fan_pareto_calc_run ON public.fan_concentration_pareto_hhi(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_aging_calc_run ON public.fan_aging_migration_matrix(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_vintage_calc_run ON public.fan_invoice_vintage_curve(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_stress_calc_run ON public.fan_stress_scenario(calculation_run_id);

-- Enable RLS for all new tables
ALTER TABLE public.fan_concentration_pareto_hhi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_aging_migration_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_invoice_vintage_curve ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_stress_scenario ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for fan_concentration_pareto_hhi" ON public.fan_concentration_pareto_hhi FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for fan_aging_migration_matrix" ON public.fan_aging_migration_matrix FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for fan_invoice_vintage_curve" ON public.fan_invoice_vintage_curve FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for fan_stress_scenario" ON public.fan_stress_scenario FOR SELECT USING (true);

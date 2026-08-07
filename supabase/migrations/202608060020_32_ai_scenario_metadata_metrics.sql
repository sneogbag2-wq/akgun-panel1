-- Migration: 32_ai_scenario_metadata_metrics
-- Description: AI Engine (AIENG), Scenario Modeling (SCN), and Metadata (MET) metrics.

-- AIENG-001..024: Yapay Zeka Modelleme ve Karar Logları
CREATE TABLE IF NOT EXISTS public.aieng_agent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    agent_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    response_hash TEXT NOT NULL,
    confidence_score NUMERIC(5, 4),
    execution_time_ms INTEGER,
    status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- SCN-001..010: Senaryo Parametreleri ve Karşılaştırmalar
CREATE TABLE IF NOT EXISTS public.scn_scenario_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    scenario_name TEXT NOT NULL,
    base_snapshot_id UUID NOT NULL,
    parameters JSONB NOT NULL,
    expected_impact_litres NUMERIC(15, 2),
    expected_impact_amount NUMERIC(15, 2),
    scenario_status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- MET-001..020: Metrik Sürüm ve Konfigürasyon Meta Verileri
CREATE TABLE IF NOT EXISTS public.met_metric_registry (
    metric_id TEXT PRIMARY KEY,
    metric_family TEXT NOT NULL,
    current_version_id UUID NOT NULL,
    rule_state TEXT NOT NULL,
    grain TEXT NOT NULL,
    formula_description TEXT NOT NULL,
    eligibility_filter TEXT,
    is_active BOOLEAN DEFAULT true,
    last_updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aieng_agent_calc_run ON public.aieng_agent_log(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_scn_scenario_calc_run ON public.scn_scenario_model(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_met_registry_family ON public.met_metric_registry(metric_family);

-- Enable RLS
ALTER TABLE public.aieng_agent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scn_scenario_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.met_metric_registry ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for aieng_agent_log" ON public.aieng_agent_log FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for scn_scenario_model" ON public.scn_scenario_model FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for met_metric_registry" ON public.met_metric_registry FOR SELECT USING (true);

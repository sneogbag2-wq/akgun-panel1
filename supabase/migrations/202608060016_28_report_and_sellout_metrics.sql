-- Migration: 28_report_and_sellout_metrics
-- Description: Reporting (RPT) and Sellout Analytics (SORPT) tables.

-- RPT-002: report_result_manifest
CREATE TABLE IF NOT EXISTS public.rpt_report_manifest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    snapshot_hash TEXT NOT NULL,
    report_definition_id TEXT NOT NULL,
    filters JSONB,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RPT-004/005: exported_artifacts
CREATE TABLE IF NOT EXISTS public.rpt_exported_artifact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id UUID REFERENCES public.rpt_report_manifest(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL,
    artifact_type TEXT NOT NULL, -- PDF, XLSX, IMAGE
    template_version TEXT NOT NULL,
    file_path TEXT,
    export_status TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- SORPT-001: monthly_sellout_series
CREATE TABLE IF NOT EXISTS public.sorpt_monthly_sellout (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    dimension_keys JSONB NOT NULL,
    billing_month TEXT NOT NULL, -- YYYY-MM
    gross_litres NUMERIC(15, 2),
    return_litres NUMERIC(15, 2),
    net_litres NUMERIC(15, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- SORPT-006: channel_share_shift
CREATE TABLE IF NOT EXISTS public.sorpt_channel_share (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    channel_type TEXT NOT NULL,
    comparison_period_type TEXT NOT NULL,
    current_share_pct NUMERIC(5, 2),
    previous_share_pct NUMERIC(5, 2),
    shift_pct_points NUMERIC(5, 2),
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rpt_manifest_calc_run ON public.rpt_report_manifest(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_rpt_export_manifest ON public.rpt_exported_artifact(manifest_id);
CREATE INDEX IF NOT EXISTS idx_sorpt_monthly_calc_run ON public.sorpt_monthly_sellout(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_sorpt_channel_calc_run ON public.sorpt_channel_share(calculation_run_id);

-- Enable RLS
ALTER TABLE public.rpt_report_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpt_exported_artifact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sorpt_monthly_sellout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sorpt_channel_share ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for rpt_report_manifest" ON public.rpt_report_manifest FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for rpt_exported_artifact" ON public.rpt_exported_artifact FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for sorpt_monthly_sellout" ON public.sorpt_monthly_sellout FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for sorpt_channel_share" ON public.sorpt_channel_share FOR SELECT USING (true);

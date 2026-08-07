-- Migration: 30_cus_org_dq_metrics
-- Description: Customer Resolution (CUS), Organization Hierarchy (ORG) and Data Quality (DQ) metrics.

-- CUS-001..008: Customer Resolution and Status
CREATE TABLE IF NOT EXISTS public.cus_resolution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    customer_id TEXT NOT NULL,
    master_snapshot_id UUID,
    customer_status TEXT NOT NULL,          -- CUS-002
    master_channel TEXT NOT NULL,           -- CUS-003
    customer_segment TEXT,                  -- CUS-004
    fkns_eligible BOOLEAN DEFAULT false,    -- CUS-005
    financial_scope BOOLEAN DEFAULT false,  -- CUS-006
    master_field_resolution TEXT,           -- CUS-007
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ORG-001..008: Organization Hierarchy and Rep Assignment
CREATE TABLE IF NOT EXISTS public.org_hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    rep_id TEXT NOT NULL,
    ssm_id TEXT,                            -- ORG-003
    dominant_ssm_ratio NUMERIC(5, 4),       -- ORG-002
    financial_retention BOOLEAN DEFAULT false, -- ORG-004
    ssm_target_litres NUMERIC(15, 2),       -- ORG-005
    ssm_actual_litres NUMERIC(15, 2),       -- ORG-006
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- DQ-001..00x: Data Quality Issues and Exclusions
CREATE TABLE IF NOT EXISTS public.dq_issue_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    metric_id TEXT NOT NULL,
    record_ref_id TEXT NOT NULL,
    issue_type TEXT NOT NULL, -- e.g., 'UNCLASSIFIED_CHANNEL', 'UNRESOLVED_REP', 'CONFLICT_REVIEW'
    issue_description TEXT,
    severity TEXT NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cus_resolution_calc_run ON public.cus_resolution(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_org_hierarchy_calc_run ON public.org_hierarchy(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_dq_issue_log_calc_run ON public.dq_issue_log(calculation_run_id);

-- Enable RLS
ALTER TABLE public.cus_resolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dq_issue_log ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for cus_resolution" ON public.cus_resolution FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for org_hierarchy" ON public.org_hierarchy FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for dq_issue_log" ON public.dq_issue_log FOR SELECT USING (true);

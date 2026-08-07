-- 202608060022_34_fctl_coll_prd_metrics.sql
-- Migration 34: FCTL (Financial Control), COLL (Collections), PRD (Productivity) Metrik Aileleri Şeması

BEGIN;

-- 1. FCTL: Financial Control Metrics (Finansal Kontrol Ailesi)
CREATE TABLE IF NOT EXISTS public.fctl_financial_control_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    control_code TEXT NOT NULL, -- e.g. FCTL-001 (Credit Limit Override), FCTL-002 (Unmatched Invoice Warning)
    risk_score NUMERIC(5,2) DEFAULT 0.00,
    control_status TEXT NOT NULL CHECK (control_status IN ('PASSED', 'WARNING', 'BLOCKED', 'OVERRIDDEN')),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. COLL: Collection & Cash-flow Performance Metrics (Tahsilat/Nakit Akış Ailesi)
CREATE TABLE IF NOT EXISTS public.coll_collection_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    period_year_month TEXT NOT NULL, -- YYYY-MM
    total_due_amount NUMERIC(15,2) DEFAULT 0.00,
    collected_amount NUMERIC(15,2) DEFAULT 0.00,
    collection_efficiency_index NUMERIC(5,2) DEFAULT 0.00, -- COLL-001 (CEI Ratio)
    average_days_overdue INTEGER DEFAULT 0, -- COLL-002 (ADO)
    uncollected_risk_ratio NUMERIC(5,2) DEFAULT 0.00, -- COLL-003
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PRD: Sales Rep & Organizational Productivity Metrics (Verimlilik Ailesi)
CREATE TABLE IF NOT EXISTS public.prd_productivity_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_rep_id TEXT NOT NULL,
    period_year_month TEXT NOT NULL, -- YYYY-MM
    visit_efficiency_rate NUMERIC(5,2) DEFAULT 0.00, -- PRD-001
    active_customer_coverage_rate NUMERIC(5,2) DEFAULT 0.00, -- PRD-002
    revenue_per_active_customer NUMERIC(15,2) DEFAULT 0.00, -- PRD-003
    collection_target_attainment_pct NUMERIC(5,2) DEFAULT 0.00, -- PRD-004
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Güvenlik Politikaları
ALTER TABLE public.fctl_financial_control_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coll_collection_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_productivity_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated Read FCTL" ON public.fctl_financial_control_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Read COLL" ON public.coll_collection_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Read PRD" ON public.prd_productivity_metrics FOR SELECT TO authenticated USING (true);

COMMIT;

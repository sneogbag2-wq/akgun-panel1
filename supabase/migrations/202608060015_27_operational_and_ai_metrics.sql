-- Migration: 27_operational_and_ai_metrics
-- Description: Operational Documents (OPS-DOC, STL), Print Audit (NOTEPRINT) and AI Focus (AIFOCUS) tables.

-- OPS-DOC-001: transient_operational_documents
CREATE TABLE IF NOT EXISTS public.ops_doc_transient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    customer_id TEXT NOT NULL,
    document_no TEXT,
    document_type TEXT NOT NULL,
    amount NUMERIC(15, 2),
    document_date TIMESTAMPTZ,
    reconciliation_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- STL-003: matched_operational_collection_signal
CREATE TABLE IF NOT EXISTS public.stl_matched_signal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    effective_sellout_date TIMESTAMPTZ NOT NULL,
    operational_amount NUMERIC(15, 2),
    matched_official_amount NUMERIC(15, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- NOTEPRINT-012: artifact_audit_integrity
CREATE TABLE IF NOT EXISTS public.noteprint_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id TEXT NOT NULL,
    document_snapshot_hash TEXT NOT NULL,
    artifact_hash TEXT NOT NULL,
    print_job_status TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- AIFOCUS-001: focus_context_contract
CREATE TABLE IF NOT EXISTS public.aifocus_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    context_hash TEXT NOT NULL,
    domain_entity_id TEXT NOT NULL,
    evidence_refs JSONB,
    priority TEXT NOT NULL,
    display_state TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- AIFOCUS-003: on_demand_claim_set
CREATE TABLE IF NOT EXISTS public.aifocus_claim (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID REFERENCES public.aifocus_context(id) ON DELETE CASCADE,
    claim_type TEXT NOT NULL,
    claim_content TEXT NOT NULL,
    confidence_level TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ops_doc_calc_run ON public.ops_doc_transient(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_stl_matched_calc_run ON public.stl_matched_signal(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_aifocus_ctx_run ON public.aifocus_context(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_aifocus_claim_ctx ON public.aifocus_claim(context_id);

-- Enable RLS
ALTER TABLE public.ops_doc_transient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stl_matched_signal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noteprint_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aifocus_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aifocus_claim ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for ops_doc_transient" ON public.ops_doc_transient FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for stl_matched_signal" ON public.stl_matched_signal FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for noteprint_audit_log" ON public.noteprint_audit_log FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for aifocus_context" ON public.aifocus_context FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for aifocus_claim" ON public.aifocus_claim FOR SELECT USING (true);

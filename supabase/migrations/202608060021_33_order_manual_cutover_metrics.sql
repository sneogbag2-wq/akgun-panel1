-- Migration: 33_order_manual_cutover_metrics
-- Description: Order Operations (ORDOP), Replenishment Requests (REQ), Manual Overrides (MAN) and Cutover (CUT) logs.

-- ORDOP-001..010: Sipariş Operasyon Logları ve Kararları
CREATE TABLE IF NOT EXISTS public.ordop_operation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    order_ref_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- e.g., 'SUBMITTED', 'BLOCKED', 'APPROVED'
    order_litres NUMERIC(15, 2),
    block_reason TEXT,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- REQ-001..005: İkmal ve Talep Gereksinimleri
CREATE TABLE IF NOT EXISTS public.req_replenishment_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    requested_litres NUMERIC(15, 2),
    urgency_level TEXT NOT NULL,
    fulfilment_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- MAN-001..010: Manuel Müdahale (Override) İzleri
CREATE TABLE IF NOT EXISTS public.man_override_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    metric_id TEXT NOT NULL,
    record_ref_id TEXT NOT NULL,
    original_value JSONB,
    overridden_value JSONB NOT NULL,
    actor_id TEXT NOT NULL,
    override_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CUT-001..005: Sistem Geçiş (Cutover) Dönemi Kayıtları
CREATE TABLE IF NOT EXISTS public.cut_transition_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_batch_id UUID NOT NULL,
    legacy_system_ref TEXT NOT NULL,
    new_system_ref TEXT NOT NULL,
    sync_status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'PENDING_MANUAL'
    discrepancy_details JSONB,
    processed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ordop_calc_run ON public.ordop_operation_log(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_req_replenish_calc_run ON public.req_replenishment_request(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_man_override_calc_run ON public.man_override_audit(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_cut_transition_batch ON public.cut_transition_log(sync_batch_id);

-- Enable RLS
ALTER TABLE public.ordop_operation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.req_replenishment_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.man_override_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cut_transition_log ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for ordop_operation_log" ON public.ordop_operation_log FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for req_replenishment_request" ON public.req_replenishment_request FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for man_override_audit" ON public.man_override_audit FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for cut_transition_log" ON public.cut_transition_log FOR SELECT USING (true);

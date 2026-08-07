-- ==============================================================================
-- Paket 08A, 10 & 10A: Tahsilat, Cari Defter, FIFO ve Fatura Kontrol
-- ==============================================================================

-- 1) invoice_delivery_control_run Tablosu
CREATE TABLE IF NOT EXISTS public.invoice_delivery_control_run (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    as_of_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2) invoice_delivery_candidate Tablosu
CREATE TABLE IF NOT EXISTS public.invoice_delivery_candidate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES public.invoice_delivery_control_run(id) ON DELETE CASCADE,
    invoice_no TEXT,
    sales_document_no TEXT,
    customer_no TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    match_status TEXT NOT NULL CHECK (match_status IN ('CONFIRMED_DUAL_KEY', 'CONFIRMED_SINGLE_KEY', 'DELIVERED_WITHOUT_INVOICE_REFERENCE', 'ORDER_INVOICE_REFERENCE_NOT_IN_SALES_SOURCE', 'INVOICE_ORDER_KEY_CONFLICT', 'AMBIGUOUS', 'COVERAGE_INCOMPLETE')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3) invoice_control_evidence Tablosu
CREATE TABLE IF NOT EXISTS public.invoice_control_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES public.invoice_delivery_candidate(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    evidence_detail JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4) invoice_control_alert Tablosu
CREATE TABLE IF NOT EXISTS public.invoice_control_alert (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES public.invoice_delivery_candidate(id) ON DELETE CASCADE,
    alert_level TEXT NOT NULL CHECK (alert_level IN ('BLOCKED_DATA', 'CRITICAL_REVIEW', 'HIGH_RISK', 'ATTENTION', 'CLEAR_WITH_EVIDENCE')),
    alert_message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5) allocation Tablosu (FIFO / Cari tahsilat dağıtımı)
CREATE TABLE IF NOT EXISTS public.allocation (
    allocation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calculation_run_id UUID,
    customer_id TEXT NOT NULL,
    invoice_event_id UUID,
    credit_event_id UUID,
    allocated_amount NUMERIC NOT NULL,
    effective_date DATE NOT NULL,
    allocation_order INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('FIFO', 'MANUAL_OVERRIDE')),
    validity TEXT NOT NULL CHECK (validity IN ('ACTIVE', 'SUPERSEDED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- İndeksler
CREATE INDEX idx_invoice_delivery_candidate_run ON public.invoice_delivery_candidate(run_id);
CREATE INDEX idx_invoice_delivery_candidate_inv ON public.invoice_delivery_candidate(invoice_no);
CREATE INDEX idx_allocation_customer ON public.allocation(customer_id);
CREATE INDEX idx_allocation_effective_date ON public.allocation(effective_date);

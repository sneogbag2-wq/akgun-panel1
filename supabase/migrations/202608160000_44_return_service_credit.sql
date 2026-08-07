-- Paket 09: İADE / HİZMET Tahsilatı
-- Migration: 44_return_service_credit

CREATE TABLE IF NOT EXISTS public.return_service_credit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    document_no TEXT NOT NULL,
    credit_type TEXT NOT NULL, -- 'IADE', 'HIZMET'
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_service_cust ON public.return_service_credit_event(customer_id);

ALTER TABLE public.return_service_credit_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for return_service_credit_event" ON public.return_service_credit_event;
CREATE POLICY "Allow authenticated read for return_service_credit_event" ON public.return_service_credit_event FOR SELECT USING (true);


-- Paket 10A: Teslim Edilmiş Fatura Kontrol
-- Migration: 45_delivered_invoice_check

CREATE TABLE IF NOT EXISTS public.delivered_invoice_check (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    delivery_doc_no TEXT,
    d_minus_1_proof BOOLEAN NOT NULL DEFAULT false,
    risk_status TEXT NOT NULL DEFAULT 'OK', -- 'OK', 'WARNING', 'RISK'
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivered_invoice_open_stack (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    open_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    stack_type TEXT NOT NULL DEFAULT 'CURRENT', -- 'PREVIOUS', 'CURRENT'
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliv_inv_cust ON public.delivered_invoice_check(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliv_stack_cust ON public.delivered_invoice_open_stack(customer_id);

ALTER TABLE public.delivered_invoice_check ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivered_invoice_open_stack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for delivered_invoice_check" ON public.delivered_invoice_check;
CREATE POLICY "Allow authenticated read for delivered_invoice_check" ON public.delivered_invoice_check FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for delivered_invoice_open_stack" ON public.delivered_invoice_open_stack;
CREATE POLICY "Allow authenticated read for delivered_invoice_open_stack" ON public.delivered_invoice_open_stack FOR SELECT USING (true);


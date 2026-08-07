-- Paket 08B: Senet/Bono Hazırlama ve Yazdırma
-- Migration: 43_promissory_note_templates

CREATE TABLE IF NOT EXISTS public.promissory_note_draft (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    installment_count INTEGER NOT NULL DEFAULT 1,
    template_version TEXT NOT NULL DEFAULT 'v1_A5_legal',
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'PRINTED', 'SIGNED'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promissory_note_installment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES public.promissory_note_draft(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promissory_draft_cust ON public.promissory_note_draft(customer_id);
CREATE INDEX IF NOT EXISTS idx_promissory_inst_draft ON public.promissory_note_installment(draft_id);

ALTER TABLE public.promissory_note_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promissory_note_installment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for promissory_note_draft" ON public.promissory_note_draft;
CREATE POLICY "Allow authenticated read for promissory_note_draft" ON public.promissory_note_draft FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for promissory_note_installment" ON public.promissory_note_installment;
CREATE POLICY "Allow authenticated read for promissory_note_installment" ON public.promissory_note_installment FOR SELECT USING (true);


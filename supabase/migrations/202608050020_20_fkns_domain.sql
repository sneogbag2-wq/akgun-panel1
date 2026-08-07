-- Migration: Paket 05 FKNS Motoru Domain Katmanı
-- Purpose: FKNS-001..017, CUS-005, Ürün Uygunluk ve İkincil Hedefler

BEGIN;

CREATE TABLE IF NOT EXISTS public.fkns_product_eligibility (
  eligibility_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('AÇIK', 'KAPALI', 'TÜMÜ')),
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  CHECK (valid_from <= valid_to)
);
CREATE UNIQUE INDEX IF NOT EXISTS fkns_eligibility_overlap_idx ON public.fkns_product_eligibility (family_id, channel_type)
  WHERE valid_to >= valid_from; -- Simplified for demo

CREATE TABLE IF NOT EXISTS public.fkns_secondary_targets (
  target_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key text NOT NULL, -- YYYY-MM
  rep_id text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('GENERAL_CHANNEL', 'PRODUCT_FAMILY')),
  target_reference text NOT NULL, -- channel name OR family_id
  target_percentage numeric, -- 0..100. NULL indicates MISSING_SOURCE
  audit_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL
);

-- Core Active Customer Universe (CUS-005) View Function
-- Returns base denominator: ACTIVE customers, with channel mapped, up to the given month
CREATE OR REPLACE FUNCTION public.fkns_eligible_customers(p_month text)
RETURNS TABLE (
  customer_id text,
  channel_type text,
  rep_id text,
  ssm_id text
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.customer_id,
    COALESCE(c.channel, 'UNRESOLVED'),
    c.rep_id,
    c.ssm_id
  FROM public.customer_master_resolutions c
  WHERE c.status = 'ACTIVE' 
    AND c.valid_from <= (p_month || '-01')::date
    AND COALESCE(c.valid_to, '9999-12-31'::date) >= (p_month || '-01')::date;
END;
$$;

COMMIT;

-- Migration: Paket 05 FKNS Motoru RLS ve Read Modelleri

BEGIN;

CREATE OR REPLACE VIEW public.fkns_performance_v AS
SELECT 
  'GENERAL' as metric_kind
; -- Dummy view structure for now, the real business logic is implemented in the Node layer due to complexity of OR-logic and rule isolation during feature flag testing

-- RLS: sellout.upload, sellout.publish, sellout.view
ALTER TABLE public.fkns_product_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fkns_eligibility_view_policy" ON public.fkns_product_eligibility
  FOR SELECT USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'fkns.read'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'sellout.view'
  );

ALTER TABLE public.fkns_secondary_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fkns_targets_view_policy" ON public.fkns_secondary_targets
  FOR SELECT USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'fkns.read'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'sellout.view'
  );

CREATE POLICY "fkns_targets_modify_policy" ON public.fkns_secondary_targets
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'sellout.publish'
  );

COMMIT;

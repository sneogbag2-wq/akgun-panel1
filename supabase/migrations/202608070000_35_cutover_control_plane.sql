-- Paket 15: Cutover ve Control Plane Yapısı
-- Migration: 35_cutover_control_plane

CREATE TABLE IF NOT EXISTS public.feature_capability_registry (
    feature_key TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SHADOW', 'FROZEN', 'V2_ONLY'
    cohort_rules JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cutover_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT NOT NULL REFERENCES public.feature_capability_registry(feature_key) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Varsayılan Özellik Bayrakları
INSERT INTO public.feature_capability_registry (feature_key, status)
VALUES 
    ('FKNS_READ', 'SHADOW'),
    ('SELLOUT_READ', 'SHADOW'),
    ('STOCK_READ', 'SHADOW'),
    ('LEGACY_WRITE', 'ACTIVE')
ON CONFLICT (feature_key) DO NOTHING;

-- RLS Güvenlik Politikaları
ALTER TABLE public.feature_capability_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutover_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read for feature_capability_registry" 
    ON public.feature_capability_registry FOR SELECT USING (true);

CREATE POLICY "Allow authenticated read for cutover_audit_log" 
    ON public.cutover_audit_log FOR SELECT USING (true);

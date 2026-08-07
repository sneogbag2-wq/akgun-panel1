-- FAN-022: Eş Grup ve Dönem Kıyasları
CREATE TABLE IF NOT EXISTS fan_peer_group_comparison (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    entity_type VARCHAR(30) NOT NULL, -- CUSTOMER, REPRESENTATIVE, SSM
    entity_id UUID NOT NULL,
    metric_code VARCHAR(50) NOT NULL,
    peer_group_type VARCHAR(50) NOT NULL, -- CHANNEL, MASTER_SEGMENT, COMPANY_FALLBACK
    peer_group_size INTEGER NOT NULL,
    entity_value NUMERIC(15, 2),
    percentile_rank NUMERIC(5, 2), -- CUME_DIST percentile (0-100)
    p25_value NUMERIC(15, 2),
    median_value NUMERIC(15, 2),
    p75_value NUMERIC(15, 2),
    is_fallback BOOLEAN DEFAULT FALSE,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-023: Müşteri 360 Finansal Özet
CREATE TABLE IF NOT EXISTS fan_customer_360_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    period_label VARCHAR(20),
    total_balance NUMERIC(15, 2),
    open_instrument_risk NUMERIC(15, 2),
    total_risk NUMERIC(15, 2),
    dso_days NUMERIC(8, 2),
    cei_percent NUMERIC(5, 2),
    health_score NUMERIC(5, 2),
    recommended_limit NUMERIC(15, 2),
    limit_usage_percent NUMERIC(5, 2),
    active_warnings_count INTEGER DEFAULT 0,
    behavior_segment VARCHAR(50),
    metric_result_ids JSONB, -- bağlı alt metrik ID listesi
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-024: Takip Önerisi Sonuç Ölçümü
CREATE TABLE IF NOT EXISTS fan_recommendation_conversion_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    recommendation_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PRESENTED', -- PRESENTED, OPENED, CONVERTED, DISMISSED, EXPIRED
    initial_risk_amount NUMERIC(15, 2),
    action_taken_at TIMESTAMP WITH TIME ZONE,
    relief_7d_amount NUMERIC(15, 2) DEFAULT 0,
    relief_14d_amount NUMERIC(15, 2) DEFAULT 0,
    relief_30d_amount NUMERIC(15, 2) DEFAULT 0,
    association_type VARCHAR(50) DEFAULT 'TEMPORAL_ASSOCIATION', -- TEMPORAL_ASSOCIATION, DESCRIPTIVE_ASSOCIATION
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

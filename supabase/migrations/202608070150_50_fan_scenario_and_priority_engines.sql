-- FAN-015: Açıklanabilir tahsilat takip önceliği
CREATE TABLE IF NOT EXISTS fan_collection_priority_score (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    score NUMERIC(5, 2), -- 0-100 or null if coverage < 60%
    is_manual_review BOOLEAN DEFAULT FALSE,
    risk_materiality_score NUMERIC(5, 2),
    aging_severity_score NUMERIC(5, 2),
    instrument_risk_score NUMERIC(5, 2),
    recent_deterioration_score NUMERIC(5, 2),
    limit_breach_score NUMERIC(5, 2),
    active_weights_sum NUMERIC(5, 2),
    top_3_reasons JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-016: Stres ve senaryo motoru
CREATE TABLE IF NOT EXISTS fan_stress_scenario_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scenario_type VARCHAR(50), -- e.g., 'COLLECTION_MINUS_25', 'COLLECTION_DELAYED_14D'
    base_exposure NUMERIC(15, 2),
    scenario_exposure NUMERIC(15, 2),
    impact_amount NUMERIC(15, 2),
    assumptions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-017: En büyük karşı taraf kaybı testi
CREATE TABLE IF NOT EXISTS fan_counterparty_loss_test (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scenario_horizon VARCHAR(50), -- e.g., 'TOP_1_DEFAULT', 'TOP_5_DEFAULT'
    defaulted_customer_ids JSONB,
    total_exposure_at_risk NUMERIC(15, 2),
    cash_impact_amount NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-018: Yönetimsel beklenen zarar senaryosu
CREATE TABLE IF NOT EXISTS fan_expected_loss_scenario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_id UUID,
    segment_id VARCHAR(50),
    ead_amount NUMERIC(15, 2), -- Exposure at Default
    pd_rate NUMERIC(5, 4), -- Probability of Default
    lgd_rate NUMERIC(5, 4), -- Loss Given Default
    expected_loss_amount NUMERIC(15, 2), -- EAD * PD * LGD
    is_scenario_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-019: Yeniden açıklama/restatement etkisi
CREATE TABLE IF NOT EXISTS fan_restatement_impact (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_label VARCHAR(20),
    metric_code VARCHAR(50),
    original_published_value NUMERIC(15, 2),
    current_recalculated_value NUMERIC(15, 2),
    variance_amount NUMERIC(15, 2),
    variance_reasons JSONB, -- { late_upload: X, user_correction: Y, etc. }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

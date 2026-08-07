-- HLT-001: Müşteri Finansal Sağlık Skoru
CREATE TABLE IF NOT EXISTS fan_financial_health_score (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    health_score NUMERIC(5, 2) CHECK (health_score >= 0 AND health_score <= 100),
    category VARCHAR(20), -- EXCELLENT, GOOD, FAIR, POOR, CRITICAL
    confidence VARCHAR(20), -- HIGH, MEDIUM, LOW
    collection_score NUMERIC(5, 2),
    aging_score NUMERIC(5, 2),
    instrument_risk_score NUMERIC(5, 2),
    payment_speed_score NUMERIC(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HLT-002: Sağlık Skoru Bileşeni Açıklaması
CREATE TABLE IF NOT EXISTS fan_financial_health_component (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    health_score_id UUID REFERENCES fan_financial_health_score(id),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    component_name VARCHAR(50),
    component_score NUMERIC(5, 2),
    impact_points NUMERIC(5, 2),
    reason TEXT,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LIM-001: İç Kredi Limiti Önerisi
CREATE TABLE IF NOT EXISTS fan_internal_limit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    health_score NUMERIC(5, 2),
    recommended_limit NUMERIC(15, 2),
    current_usage NUMERIC(15, 2),
    headroom NUMERIC(15, 2),
    valid_until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LIM-002: Limit Değişim Geçmişi
CREATE TABLE IF NOT EXISTS fan_internal_limit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_limit NUMERIC(15, 2),
    new_limit NUMERIC(15, 2),
    change_reason TEXT,
    triggered_by VARCHAR(50), -- HEALTH_SCORE, MANUAL, SCORING_RULE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRF-001: Temsilci Finansal Performans Karnesi
CREATE TABLE IF NOT EXISTS fan_rep_financial_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    representative_id UUID NOT NULL,
    representative_name VARCHAR(100),
    period_label VARCHAR(20),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overall_score NUMERIC(5, 2),
    collection_score NUMERIC(5, 2),
    cei_score NUMERIC(5, 2),
    limit_discipline_score NUMERIC(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRF-002: SSM (Bölge) Finansal Performans Karnesi
CREATE TABLE IF NOT EXISTS fan_ssm_financial_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    ssm_id UUID NOT NULL,
    ssm_name VARCHAR(100),
    period_label VARCHAR(20),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overall_score NUMERIC(5, 2),
    cei_score NUMERIC(5, 2),
    limit_discipline_score NUMERIC(5, 2),
    rep_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

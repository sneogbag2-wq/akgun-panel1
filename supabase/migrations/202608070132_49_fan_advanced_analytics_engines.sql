-- FAN-009 Instrument Expected Realization
CREATE TABLE IF NOT EXISTS fan_instrument_expected_realization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    as_of_date DATE,
    instrument_type VARCHAR(50),
    maturity_bucket VARCHAR(50),
    face_value NUMERIC(15, 2) DEFAULT 0,
    calibrated_probability NUMERIC(5, 4) DEFAULT 1.0000,
    expected_cash NUMERIC(15, 2) DEFAULT 0, -- face_value * calibrated_probability
    fallback_level VARCHAR(50) DEFAULT 'CUSTOMER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-010 13-Week Cash Forecast
CREATE TABLE IF NOT EXISTS fan_cash_forecast_13w (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    as_of_date DATE,
    forecast_scope VARCHAR(50) DEFAULT 'EXISTING_BOOK', -- EXISTING_BOOK or EXTENDED_OPERATING
    week_bucket VARCHAR(20), -- e.g., '1-7', '8-14'
    p25_forecast NUMERIC(15, 2) DEFAULT 0,
    p50_forecast NUMERIC(15, 2) DEFAULT 0,
    p75_forecast NUMERIC(15, 2) DEFAULT 0,
    invoice_direct_cash NUMERIC(15, 2) DEFAULT 0,
    instrument_settlement NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-011 Financial Forecast Backtest
CREATE TABLE IF NOT EXISTS fan_forecast_backtest (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    origin_date DATE,
    target_date DATE,
    horizon_weeks INTEGER,
    actual_amount NUMERIC(15, 2) DEFAULT 0,
    forecast_amount NUMERIC(15, 2) DEFAULT 0,
    wape NUMERIC(5, 4), -- Sum|actual-forecast| / Sum|actual|
    bias NUMERIC(5, 4),
    mae NUMERIC(15, 2),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-012 Early Deterioration Signals
CREATE TABLE IF NOT EXISTS fan_early_deterioration_signal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signal_type VARCHAR(50), -- e.g., 'NEW_29_PLUS_ACCEL', 'CEI_DROP'
    direction VARCHAR(20),
    material_amount NUMERIC(15, 2) DEFAULT 0,
    comparison_period VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-013 Robust Anomaly Detection
CREATE TABLE IF NOT EXISTS fan_robust_anomaly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metric_code VARCHAR(50),
    anomaly_date DATE,
    actual_value NUMERIC(15, 2),
    median_value NUMERIC(15, 2),
    mad_value NUMERIC(15, 2),
    robust_z_score NUMERIC(10, 4),
    is_anomaly BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-014 Financial Behavior Segment
CREATE TABLE IF NOT EXISTS fan_behavior_segment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    segment_class VARCHAR(50), -- e.g., 'SAGLIKLI_DONGU', 'BUYUYEN_RISK'
    evidence_tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-004 Payment Survival Curve (Ödeme Süresi Sağkalım Eğrisi)
CREATE TABLE IF NOT EXISTS fan_payment_survival_curve (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL, -- references companies(id) omitted for decoupling in pure models
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    median_survival_days INTEGER, -- S(d) <= 0.50
    total_invoices_analyzed INTEGER,
    censored_invoices INTEGER,
    survival_data JSONB, -- { day: number, survival_prob: number, remaining_amount: number }
    fallback_level VARCHAR(50), -- CUSTOMER, REP, CHANNEL, COMPANY (if sample size not enough)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-005 Aged Burden Bridge (Yaşlı Bakiye Değişim Köprüsü)
CREATE TABLE IF NOT EXISTS fan_aged_burden_bridge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    opening_29_plus NUMERIC(15, 2) DEFAULT 0,
    new_29_plus_inflow NUMERIC(15, 2) DEFAULT 0,
    aged_settlement_outflow NUMERIC(15, 2) DEFAULT 0,
    closing_29_plus NUMERIC(15, 2) DEFAULT 0,
    bridge_variance NUMERIC(15, 2) DEFAULT 0, -- closing - (opening + inflow - outflow)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-006 Total Exposure Bridge (Toplam Risk Köprüsü)
CREATE TABLE IF NOT EXISTS fan_total_exposure_bridge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    opening_total_exposure NUMERIC(15, 2) DEFAULT 0,
    sales_inflow NUMERIC(15, 2) DEFAULT 0,
    cash_collection_outflow NUMERIC(15, 2) DEFAULT 0, -- real cash out
    write_offs NUMERIC(15, 2) DEFAULT 0,
    instrument_bounce_inflow NUMERIC(15, 2) DEFAULT 0,
    closing_total_exposure NUMERIC(15, 2) DEFAULT 0,
    bridge_variance NUMERIC(15, 2) DEFAULT 0, -- Unreconciled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-007 Economic Collection Bridge (Ekonomik Tahsilat & Nakit Köprüsü)
CREATE TABLE IF NOT EXISTS fan_economic_collection_bridge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    total_economic_collection NUMERIC(15, 2) DEFAULT 0, -- All inflows from customer
    cash_risk_relief NUMERIC(15, 2) DEFAULT 0, -- Real cash/wire + paid instruments
    noncash_relief NUMERIC(15, 2) DEFAULT 0, -- RETURNS/SERVICES
    pending_instrument_volume NUMERIC(15, 2) DEFAULT 0, -- Accepted but not yet paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-008 Instrument Maturity Ladder (Çek/Senet Vade Merdiveni)
CREATE TABLE IF NOT EXISTS fan_instrument_maturity_ladder (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    as_of_date DATE,
    past_due_amount NUMERIC(15, 2) DEFAULT 0,
    past_due_count INTEGER DEFAULT 0,
    due_0_7_amount NUMERIC(15, 2) DEFAULT 0,
    due_0_7_count INTEGER DEFAULT 0,
    due_8_14_amount NUMERIC(15, 2) DEFAULT 0,
    due_8_14_count INTEGER DEFAULT 0,
    due_15_30_amount NUMERIC(15, 2) DEFAULT 0,
    due_15_30_count INTEGER DEFAULT 0,
    due_31_60_amount NUMERIC(15, 2) DEFAULT 0,
    due_31_60_count INTEGER DEFAULT 0,
    due_61_90_amount NUMERIC(15, 2) DEFAULT 0,
    due_61_90_count INTEGER DEFAULT 0,
    due_91_plus_amount NUMERIC(15, 2) DEFAULT 0,
    due_91_plus_count INTEGER DEFAULT 0,
    outcome_pending_amount NUMERIC(15, 2) DEFAULT 0,
    outcome_pending_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

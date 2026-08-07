-- Paket 12A: Temel Finansal Read Model ve Mutabakat

CREATE TABLE IF NOT EXISTS financial_daily_position (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    snapshot_date DATE NOT NULL,
    
    total_receivables NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_sales NUMERIC(15, 2) NOT NULL DEFAULT 0,
    
    -- DSO: Days Sales Outstanding (Gün Tahsilat Süresi)
    dso_days NUMERIC(10, 2),
    
    -- CEI: Collection Effectiveness Index (Tahsilat Etkinlik İndeksi)
    cei_score NUMERIC(10, 2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aynı müşterinin aynı güne ait sadece 1 snapshot'ı olabilir
CREATE UNIQUE INDEX idx_unique_daily_position ON financial_daily_position(customer_id, snapshot_date);

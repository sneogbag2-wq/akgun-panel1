-- Paket 08A: Tahsilat Arşiv Mutabakatı (Reconciliation)
-- Geçici Belgeler Katmanı ile Resmi Tahsilat Eşleşmesi

-- 1. Geçici Belgeler (TEMP_SIGNAL) Tablosu
CREATE TABLE IF NOT EXISTS temp_payment_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REPLACED_BY_OFFICIAL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Resmi Tahsilat (OFFICIAL) Tablosu (Paket 08'den genişletilmiş temsil)
CREATE TABLE IF NOT EXISTS official_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Çifte Sayım (Double Counting) Engelleyici Güvenlik View'i
-- Sadece ACTIVE olan geçici sinyaller ve tüm resmi tahsilatlar bakiyeye yansır.
CREATE OR REPLACE VIEW v_financial_ledger_payments AS
SELECT id, customer_id, amount, payment_date, 'TEMP' as source_type
FROM temp_payment_signals
WHERE status = 'ACTIVE'
UNION ALL
SELECT id, customer_id, amount, payment_date, 'OFFICIAL' as source_type
FROM official_payments;

-- Not: Geçici belge 'REPLACED_BY_OFFICIAL' (Tombstone) olduğunda bu View'den otomatik düşer.

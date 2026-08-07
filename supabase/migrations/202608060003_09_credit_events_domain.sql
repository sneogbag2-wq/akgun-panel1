-- Paket 09: IADE/HIZMET Tahsilatı (Cari Alacak Hareketi)
-- Nakit tahsilatlar ile alacak kayıtlarının kesin izolasyonu

-- 1. Satın Alma (Cari Alacak Hareketi) Tablosu
CREATE TABLE IF NOT EXISTS credit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    event_type VARCHAR(20) NOT NULL, -- 'RETURN' (İade) veya 'SERVICE' (Hizmet)
    event_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Yargıç Kırmızı Çizgisi: Negatif (-) tutarlı iade/hizmet girişi YASAK!
    CONSTRAINT chk_credit_amount_positive CHECK (amount > 0)
);

-- Note: Tahsilat (CASH/TRANSFER) işlemleri zaten Paket 08/08A ile 
-- official_payments tablosuna yazılmaktadır. credit_events tamamen izoledir.

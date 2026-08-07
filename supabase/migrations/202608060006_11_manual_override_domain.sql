-- Paket 11: Manuel İşlem, Override ve Kaynak Çatışması (Soft-Delete)

-- Örnek tablo: Manuel müdahalelere maruz kalabilen genel bir işlem tablosu (Örn: Manuel Fatura/Fiş)
CREATE TABLE IF NOT EXISTS manual_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    
    -- Kuralcı: Kaynağı ve Geçerliliği belirtmek zorunludur
    source VARCHAR(50) NOT NULL DEFAULT 'SYSTEM', -- 'SYSTEM', 'MANUAL_ENTRY', 'MANUAL_OVERRIDE'
    validity VARCHAR(50) NOT NULL DEFAULT 'VALID', -- 'VALID', 'OVERRIDDEN'
    
    -- Kuralcı: Soft-delete kuralı
    deleted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fiziksel silinme (DELETE) kalkanı (Opsiyonel olarak Trigger ile zorlanabilir ama uygulama seviyesinde yöneteceğiz)

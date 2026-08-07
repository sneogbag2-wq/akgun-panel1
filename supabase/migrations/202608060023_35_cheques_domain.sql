-- Paket 35: Çek/Senet (Cheques) Domain Tablosu
CREATE TABLE IF NOT EXISTS public.cheques (
    id VARCHAR(100) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    issue_date DATE,
    due_date DATE,
    doc_no VARCHAR(100),
    sub_no VARCHAR(100),
    status VARCHAR(50) DEFAULT 'CREATED',
    type VARCHAR(50) DEFAULT 'ÇEK',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

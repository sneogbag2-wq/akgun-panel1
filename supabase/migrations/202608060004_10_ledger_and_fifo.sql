-- Paket 10: Cari Defter, FIFO Dağıtımı ve Fatura Yaşlandırma

CREATE TABLE IF NOT EXISTS invoice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    invoice_amount NUMERIC(15, 2) NOT NULL,
    invoice_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tahsilat dağıtım tablosu
CREATE TABLE IF NOT EXISTS invoice_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID,
    customer_id VARCHAR(50) NOT NULL,
    invoice_event_id UUID NOT NULL REFERENCES invoice_events(id),
    credit_event_id UUID NOT NULL,
    allocated_amount NUMERIC(15, 2) NOT NULL,
    effective_date DATE NOT NULL,
    allocation_order INT NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'FIFO',
    validity VARCHAR(20) NOT NULL DEFAULT 'VALID',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_allocated_amount_positive CHECK (allocated_amount > 0)
);

-- Açık faturaların güncel durumunu gösteren temel View
CREATE OR REPLACE VIEW v_open_invoices AS
SELECT 
    i.id AS invoice_id,
    i.customer_id,
    i.invoice_amount,
    i.invoice_date,
    COALESCE(SUM(a.allocated_amount), 0) AS total_allocated,
    i.invoice_amount - COALESCE(SUM(a.allocated_amount), 0) AS open_amount
FROM invoice_events i
LEFT JOIN invoice_allocations a ON i.id = a.invoice_event_id AND a.validity = 'VALID'
GROUP BY i.id, i.customer_id, i.invoice_amount, i.invoice_date
HAVING i.invoice_amount - COALESCE(SUM(a.allocated_amount), 0) > 0;

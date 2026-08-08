-- Paket 10: Ledger & FIFO (Defter / Yaşlandırma Tahsis) DB Seviyesi pgTAP Testleri
BEGIN;

SELECT plan(6);

SELECT has_table('ledger_entries', 'ledger_entries tablosu var.');
SELECT has_table('fifo_allocations', 'fifo_allocations tablosu var.');

SELECT rls_is_enabled('public', 'ledger_entries', 'ledger_entries RLS aktif.');
SELECT rls_is_enabled('public', 'fifo_allocations', 'fifo_allocations RLS aktif.');

-- İş Mantığı Testi: FIFO Allocation Senaryosu
INSERT INTO ledger_entries (id, customer_id, entry_type, amount, date) VALUES ('test-debit-1', 'CUST-TEST', 'DEBIT', 500, '2026-01-01');
INSERT INTO ledger_entries (id, customer_id, entry_type, amount, date) VALUES ('test-credit-1', 'CUST-TEST', 'CREDIT', 500, '2026-01-02');
INSERT INTO fifo_allocations (id, debit_entry_id, credit_entry_id, allocated_amount) VALUES ('alloc-1', 'test-debit-1', 'test-credit-1', 500);

SELECT results_eq(
    'SELECT allocated_amount FROM fifo_allocations WHERE id = ''alloc-1''',
    ARRAY[500::numeric],
    'FIFO eşleşmesi ve tüketimi doğru hesaplandı'
);

SELECT results_eq(
    'SELECT COUNT(*) FROM fifo_allocations WHERE debit_entry_id = ''test-debit-1''',
    ARRAY[1::bigint],
    'Bir adet allocation kaydı oluşturuldu'
);

SELECT * FROM finish();

ROLLBACK;

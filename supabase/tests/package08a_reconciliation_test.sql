-- Paket 08A: Reconciliation (Mutabakat Yönetimi) DB Seviyesi pgTAP Testleri
BEGIN;

SELECT plan(6);

SELECT has_table('reconciliation_session', 'reconciliation_session tablosu var.');
SELECT has_table('reconciliation_discrepancy', 'reconciliation_discrepancy tablosu var.');

SELECT rls_is_enabled('public', 'reconciliation_session', 'reconciliation_session RLS aktif.');
SELECT rls_is_enabled('public', 'reconciliation_discrepancy', 'reconciliation_discrepancy RLS aktif.');

-- İş Mantığı Testi: Mutabakat eşleşme senaryosu
INSERT INTO reconciliation_session (id, customer_id, period, status, calculated_balance) VALUES ('recon-1', 'CUST-TEST', '2026-01', 'PENDING', 1000);
INSERT INTO reconciliation_discrepancy (id, session_id, type, amount, status) VALUES ('disc-1', 'recon-1', 'MISSING_INVOICE', 500, 'OPEN');

SELECT results_eq(
    'SELECT calculated_balance FROM reconciliation_session WHERE id = ''recon-1''',
    ARRAY[1000::numeric],
    'Mutabakat oturumu doğru bakiye ile oluşturuldu'
);

SELECT results_eq(
    'SELECT status FROM reconciliation_discrepancy WHERE id = ''disc-1''',
    ARRAY['OPEN'::text],
    'Mutabakat uyuşmazlık durumu doğru kaydedildi'
);

SELECT * FROM finish();

ROLLBACK;

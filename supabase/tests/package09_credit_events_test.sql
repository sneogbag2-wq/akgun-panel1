-- Paket 09: Credit Events DB Seviyesi pgTAP Testleri
BEGIN;

SELECT plan(6);

SELECT has_table('credit_events', 'credit_events tablosu var.');
SELECT has_table('credit_limit_log', 'credit_limit_log tablosu var.');

SELECT rls_is_enabled('public', 'credit_events', 'credit_events RLS aktif.');
SELECT rls_is_enabled('public', 'credit_limit_log', 'credit_limit_log RLS aktif.');

-- İş Mantığı Testi: Kredi olay senaryosu
INSERT INTO credit_events (id, customer_id, event_type, amount, status, date) VALUES ('evt-1', 'CUST-TEST', 'LIMIT_INCREASE', 1000, 'APPROVED', '2026-01-01');

SELECT results_eq(
    'SELECT amount FROM credit_events WHERE id = ''evt-1''',
    ARRAY[1000::numeric],
    'Kredi olayı doğru tutarla kaydedildi'
);

SELECT results_eq(
    'SELECT status FROM credit_events WHERE id = ''evt-1''',
    ARRAY['APPROVED'::text],
    'Kredi olay durumu doğru kaydedildi'
);

SELECT * FROM finish();

ROLLBACK;

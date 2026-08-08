-- Paket 12A: Financial Read Model DB Seviyesi pgTAP Testleri
BEGIN;

SELECT plan(4);

SELECT has_table('financial_read_models', 'financial_read_models tablosu var.');
SELECT has_table('financial_statements_summary', 'financial_statements_summary tablosu var.');

SELECT rls_is_enabled('public', 'financial_read_models', 'financial_read_models RLS aktif.');
SELECT rls_is_enabled('public', 'financial_statements_summary', 'financial_statements_summary RLS aktif.');

SELECT * FROM finish();

ROLLBACK;

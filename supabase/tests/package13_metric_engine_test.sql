-- Paket 13: Metric Engine DB Seviyesi pgTAP Testleri
BEGIN;

SELECT plan(4);

SELECT has_table('metric_engine_runs', 'metric_engine_runs tablosu var.');
SELECT has_table('metric_results', 'metric_results tablosu var.');

SELECT rls_is_enabled('public', 'metric_engine_runs', 'metric_engine_runs RLS aktif.');
SELECT rls_is_enabled('public', 'metric_results', 'metric_results RLS aktif.');

SELECT * FROM finish();

ROLLBACK;

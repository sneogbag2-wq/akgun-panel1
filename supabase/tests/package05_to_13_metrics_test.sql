BEGIN;
SELECT plan(10);

-- 1. Tabloların varlık kontrolleri
SELECT has_table('public', 'met_metric_registry', 'met_metric_registry tablosu mevcut olmalıdır');
SELECT has_table('public', 'fan_concentration_pareto_hhi', 'fan_concentration_pareto_hhi tablosu mevcut olmalıdır');
SELECT has_table('public', 'fan_invoice_vintage_curve', 'fan_invoice_vintage_curve tablosu mevcut olmalıdır');
SELECT has_table('public', 'rpt_report_manifest', 'rpt_report_manifest tablosu mevcut olmalıdır');
SELECT has_table('public', 'sorpt_monthly_sellout', 'sorpt_monthly_sellout tablosu mevcut olmalıdır');

-- 2. Kolon kontrolleri
SELECT has_column('public', 'met_metric_registry', 'metric_id', 'met_metric_registry.metric_id mevcut olmalıdır');
SELECT has_column('public', 'fan_concentration_pareto_hhi', 'calculated_at', 'fan_concentration_pareto_hhi.calculated_at mevcut olmalıdır');

-- 3. Temel veri/indeks varlığı (örnek metrikler var mı?)
SELECT has_index('public', 'met_metric_registry', 'met_metric_registry_pkey', 'metric_id', 'met_metric_registry Primary Key bulunmalıdır');
SELECT has_index('public', 'fan_concentration_pareto_hhi', 'fan_concentration_pareto_hhi_pkey', 'id', 'fan_concentration_pareto_hhi PK bulunmalıdır');

-- 4. Foreign key kontrolü
SELECT has_column('public', 'rpt_exported_artifact', 'manifest_id', 'rpt_exported_artifact.manifest_id mevcut olmalıdır');

SELECT * FROM finish();
ROLLBACK;

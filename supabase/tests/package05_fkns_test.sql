-- Paket 05: FKNS (Finansal Kalite & Risk Skorlama) DB Seviyesi pgTAP Testleri
BEGIN;

SELECT plan(4);

-- 1. Tablo ve görünüm varlık kontrolleri
SELECT has_table('fkns_financial_health_score', 'fkns_financial_health_score tablosu veritabanında var.');
SELECT has_table('fkns_risk_category_log', 'fkns_risk_category_log tablosu veritabanında var.');

-- 2. RLS durum kontrolü
SELECT rls_is_enabled('public', 'fkns_financial_health_score', 'fkns_financial_health_score üzerinde RLS aktif.');
SELECT rls_is_enabled('public', 'fkns_risk_category_log', 'fkns_risk_category_log üzerinde RLS aktif.');

SELECT * FROM finish();

ROLLBACK;

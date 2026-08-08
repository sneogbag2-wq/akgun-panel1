-- Migration: 29_new_metrics_rls_test
-- Description: pgTAP tests for the newly added FAN, FCST, OPS-DOC, and RPT metrics tables.

BEGIN;

-- Plan the tests (15 tests for RLS)
SELECT plan(15);

-- Check if tables exist
SELECT has_table('fan_concentration_pareto_hhi', 'fan_concentration_pareto_hhi table exists');
SELECT has_table('fcst_daily_model', 'fcst_daily_model table exists');
SELECT has_table('ops_doc_transient', 'ops_doc_transient table exists');
SELECT has_table('rpt_report_manifest', 'rpt_report_manifest table exists');
SELECT has_table('sorpt_monthly_sellout', 'sorpt_monthly_sellout table exists');

-- Check RLS is enabled on key tables
SELECT policies_are(
    'public',
    'fan_concentration_pareto_hhi',
    ARRAY['Allow authenticated read for fan_concentration_pareto_hhi'],
    'RLS policies for fan_concentration_pareto_hhi match'
);

SELECT policies_are(
    'public',
    'fcst_daily_model',
    ARRAY['Allow authenticated read for fcst_daily_model'],
    'RLS policies for fcst_daily_model match'
);

SELECT policies_are(
    'public',
    'ops_doc_transient',
    ARRAY['Allow authenticated read for ops_doc_transient'],
    'RLS policies for ops_doc_transient match'
);

SELECT policies_are(
    'public',
    'rpt_report_manifest',
    ARRAY['Allow authenticated read for rpt_report_manifest'],
    'RLS policies for rpt_report_manifest match'
);

SELECT policies_are(
    'public',
    'sorpt_monthly_sellout',
    ARRAY['Allow authenticated read for sorpt_monthly_sellout'],
    'RLS policies for sorpt_monthly_sellout match'
);

-- Check indexes exist
SELECT has_index('public', 'fan_concentration_pareto_hhi', 'idx_fan_pareto_calc_run', 'Calculation Run index exists on FAN');
SELECT has_index('public', 'fcst_daily_model', 'idx_fcst_model_calc_run', 'Calculation Run index exists on FCST');
SELECT has_index('public', 'ops_doc_transient', 'idx_ops_doc_calc_run', 'Calculation Run index exists on OPS-DOC');
SELECT has_index('public', 'rpt_report_manifest', 'idx_rpt_manifest_calc_run', 'Calculation Run index exists on RPT');
SELECT has_index('public', 'sorpt_monthly_sellout', 'idx_sorpt_monthly_calc_run', 'Calculation Run index exists on SORPT');

SELECT * FROM finish();

ROLLBACK;

-- Migration: 34_phase2_4_rls_test
-- Description: pgTAP tests for the newly added CUS, ORG, DQ, EVT, ACT, TGT, AIENG, SCN, MET, ORDOP, REQ, MAN, CUT metrics tables.

BEGIN;

-- Plan the tests (12 tables * 3 = 36 tests + some index tests)
SELECT plan(24);

-- Check if tables exist
SELECT has_table('cus_resolution', 'cus_resolution table exists');
SELECT has_table('org_hierarchy', 'org_hierarchy table exists');
SELECT has_table('dq_issue_log', 'dq_issue_log table exists');
SELECT has_table('evt_sellout_event', 'evt_sellout_event table exists');
SELECT has_table('act_metric_actual', 'act_metric_actual table exists');
SELECT has_table('tgt_performance_attainment', 'tgt_performance_attainment table exists');
SELECT has_table('aieng_agent_log', 'aieng_agent_log table exists');
SELECT has_table('scn_scenario_model', 'scn_scenario_model table exists');
SELECT has_table('met_metric_registry', 'met_metric_registry table exists');
SELECT has_table('ordop_operation_log', 'ordop_operation_log table exists');
SELECT has_table('req_replenishment_request', 'req_replenishment_request table exists');
SELECT has_table('man_override_audit', 'man_override_audit table exists');

-- Check RLS is enabled on key tables
SELECT policies_are('public', 'cus_resolution', ARRAY['Allow authenticated read for cus_resolution'], 'RLS policies match');
SELECT policies_are('public', 'org_hierarchy', ARRAY['Allow authenticated read for org_hierarchy'], 'RLS policies match');
SELECT policies_are('public', 'evt_sellout_event', ARRAY['Allow authenticated read for evt_sellout_event'], 'RLS policies match');
SELECT policies_are('public', 'act_metric_actual', ARRAY['Allow authenticated read for act_metric_actual'], 'RLS policies match');
SELECT policies_are('public', 'tgt_performance_attainment', ARRAY['Allow authenticated read for tgt_performance_attainment'], 'RLS policies match');
SELECT policies_are('public', 'aieng_agent_log', ARRAY['Allow authenticated read for aieng_agent_log'], 'RLS policies match');
SELECT policies_are('public', 'scn_scenario_model', ARRAY['Allow authenticated read for scn_scenario_model'], 'RLS policies match');
SELECT policies_are('public', 'ordop_operation_log', ARRAY['Allow authenticated read for ordop_operation_log'], 'RLS policies match');
SELECT policies_are('public', 'req_replenishment_request', ARRAY['Allow authenticated read for req_replenishment_request'], 'RLS policies match');
SELECT policies_are('public', 'man_override_audit', ARRAY['Allow authenticated read for man_override_audit'], 'RLS policies match');

-- Check Indexes
SELECT has_index('public', 'cus_resolution', 'idx_cus_resolution_calc_run', 'Calculation Run index exists');
SELECT has_index('public', 'aieng_agent_log', 'idx_aieng_agent_calc_run', 'Calculation Run index exists');

SELECT * FROM finish();

ROLLBACK;

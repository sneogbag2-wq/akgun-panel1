begin;
select plan(22);

create temporary table package02_state (label text primary key, batch_id uuid, validation_run_id uuid, master_snapshot_id uuid);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'package02-anonymous@example.test', 'not-a-real-password', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
insert into public.app_user_capabilities (user_id, capability)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', capability
from unnest(array['import.view','import.create','import.validate','import.publish','import.audit','customer.view','customer.audit','organization.view']) capability;

select ok(exists(select 1 from public.source_contract_versions where source_kind = 'CUSTOMER_MASTER' and publication_mode = 'FULL_REPLACE'), 'customer master source contract is a full snapshot');
insert into package02_state(label, batch_id)
select 'first', (public.initiate_import_batch('CUSTOMER_MASTER', 'anonymous-master.xlsx', 64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', repeat('a', 64),
  '{"source":"anonymous"}'::jsonb, 'CUSTOMER_MASTER:anonymous', 'customer-master-init-01', repeat('b', 64)) ->> 'batchId')::uuid;
select public.complete_import_upload((select batch_id from package02_state where label='first'), repeat('a', 64), 64);
select public.parse_customer_master_batch((select batch_id from package02_state where label='first'), jsonb_build_array(
  jsonb_build_object('sheetName','Master','sourceRowNumber',2,'rawCells','{"A2":{"rawValue":"5000000001","sourceType":"string"}}'::jsonb,'rowHash',repeat('1',64),'customerCodeCandidate','5000000001','customerCodeValid',true,'parsedPayload','{"customerName":"Anonim Market","storeName":"Anonim Tabela","salesRep":"Rep Alpha","distSalesChief":"SSM Alpha","channel":"Standart Açık","segment":"Diamond","customerStatus":"Aktif (A)"}'::jsonb,'parserWarnings','[]'::jsonb),
  jsonb_build_object('sheetName','Master','sourceRowNumber',3,'rawCells','{"A3":{"rawValue":"5000000001","sourceType":"string"}}'::jsonb,'rowHash',repeat('2',64),'customerCodeCandidate','5000000001','customerCodeValid',true,'parsedPayload','{"customerName":" anonim   market ","storeName":"","salesRep":"Rep Alpha","distSalesChief":"SSM Alpha","channel":"Standart Açık","segment":"Diamond","customerStatus":"Pasif (P)"}'::jsonb,'parserWarnings','[]'::jsonb),
  jsonb_build_object('sheetName','Master','sourceRowNumber',4,'rawCells','{"A4":{"rawValue":"5000000002","sourceType":"string"}}'::jsonb,'rowHash',repeat('3',64),'customerCodeCandidate','5000000002','customerCodeValid',true,'parsedPayload','{"customerName":"İnceleme Market","storeName":"İnceleme","salesRep":"","distSalesChief":"","channel":"Ekomini","segment":"","customerStatus":"Bilinmiyor"}'::jsonb,'parserWarnings','["UNKNOWN_CUSTOMER_STATUS"]'::jsonb),
  jsonb_build_object('sheetName','Master','sourceRowNumber',5,'rawCells','{"A5":{"rawValue":"5000000003","sourceType":"number"}}'::jsonb,'rowHash',repeat('4',64),'customerCodeCandidate','5000000003','customerCodeValid',false,'parsedPayload','{"customerName":"Sayısal Kod"}'::jsonb,'parserWarnings','["CUSTOMER_CODE_COERCION_ATTEMPT"]'::jsonb)
), 'customer-master-v2/2.0.0');
select is((select count(*)::integer from public.customer_master_row_observations where import_batch_id=(select batch_id from package02_state where label='first')), 4, 'all source rows retain immutable observations');
select is((public.validate_customer_master_batch((select batch_id from package02_state where label='first')) ->> 'status'), 'VALIDATED', 'invalid identity rows become visible quality issues without erasing valid master rows');
update package02_state set validation_run_id=(select active_validation_run_id from public.import_batches where id=batch_id) where label='first';
select is((public.publish_customer_master_batch((select batch_id from package02_state where label='first'), (select validation_run_id from package02_state where label='first'), 1, 'customer-master-publish-01', repeat('c',64), '2026-01-01T00:00:00Z'::timestamptz) ->> 'status'), 'PUBLISHED', 'first master snapshot publishes atomically');
update package02_state set master_snapshot_id=(select id from public.customer_master_snapshots where import_batch_id=batch_id) where label='first';

select is((select count(*)::integer from public.customers), 2, 'Bira or Distile style duplicate rows become one customer identity without a division entity');
select is((select count(*)::integer from public.customer_snapshot_memberships where customer_master_snapshot_id=(select master_snapshot_id from package02_state where label='first')), 2, 'one snapshot membership exists for each valid customer');
select is((select status::text from public.customer_status_versions s join public.customers c on c.customer_id=s.customer_id where c.customer_code='5000000001' and s.valid_to is null), 'ACTIVE', 'ACTIVE wins over PASSIVE for the same customer');
select is((select status::text from public.customer_status_versions s join public.customers c on c.customer_id=s.customer_id where c.customer_code='5000000002' and s.valid_to is null), 'UNKNOWN', 'unknown source status is not silently cancelled');
select ok(not exists(select 1 from public.customer_profile_versions where profile_data ? 'creditLimit' or profile_data ? 'krediLimiti'), 'credit limit never enters canonical profile data');
select is((select customer_code from public.customers where customer_code='5000000001'), '5000000001', '500 customer code remains exact text');
select is((select count(*)::integer from public.data_quality_issues where message_key='INVALID_CUSTOMER_CODE'), 1, 'numeric identity coercion produces an explicit issue');
select is((select dominant_ratio from public.rep_ssm_assignments where resolution_state='RESOLVED'), 1::numeric, 'SSM dominant ratio uses unique active customers');
select set_config('app.customer_master_publish', 'off', true);
select throws_ok($$update public.customer_profile_versions set profile_data='{}'::jsonb$$, '55000', 'CUSTOMER_MASTER_HISTORY_IMMUTABLE', 'profile history is append-only');
select is(has_table_privilege('anon','public.customers','select'), false, 'anonymous role cannot read customer identities');

insert into package02_state(label, batch_id)
select 'second', (public.initiate_import_batch('CUSTOMER_MASTER', 'anonymous-master-2.xlsx', 32, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', repeat('d',64),
  '{"source":"anonymous"}'::jsonb, 'CUSTOMER_MASTER:anonymous', 'customer-master-init-02', repeat('e',64)) ->> 'batchId')::uuid;
select public.complete_import_upload((select batch_id from package02_state where label='second'), repeat('d',64), 32);
select public.parse_customer_master_batch((select batch_id from package02_state where label='second'), jsonb_build_array(
  jsonb_build_object('sheetName','Master','sourceRowNumber',2,'rawCells','{"A2":{"rawValue":"5000000001","sourceType":"string"}}'::jsonb,'rowHash',repeat('5',64),'customerCodeCandidate','5000000001','customerCodeValid',true,'parsedPayload','{"customerName":"Anonim Market","storeName":"Anonim Tabela","salesRep":"Rep Alpha","distSalesChief":"SSM Alpha","channel":"Standart Açık","segment":"Diamond","customerStatus":"Aktif"}'::jsonb,'parserWarnings','[]'::jsonb)
), 'customer-master-v2/2.0.0');
select public.validate_customer_master_batch((select batch_id from package02_state where label='second'));
update package02_state set validation_run_id=(select active_validation_run_id from public.import_batches where id=batch_id) where label='second';
select is((public.publish_customer_master_batch((select batch_id from package02_state where label='second'), (select validation_run_id from package02_state where label='second'), 2, 'customer-master-publish-02', repeat('f',64), '2026-02-01T00:00:00Z'::timestamptz) ->> 'snapshotVersion')::integer, 2, 'new complete snapshot atomically replaces the active master pointer');
select is((select status::text from public.customer_status_versions s join public.customers c on c.customer_id=s.customer_id where c.customer_code='5000000002' and s.valid_to is null), 'NOT_PRESENT_IN_CURRENT_MASTER', 'missing full-snapshot customer is retained and not auto-cancelled');
select is((public.customer_master_customer_v2('5000000002', '2026-01-15T00:00:00Z'::timestamptz) ->> 'status'), 'UNKNOWN', 'historical as-of read remains pinned to the earlier master snapshot');
select is((public.customer_master_customer_v2('5000000001') ->> 'status'), 'ACTIVE', 'safe v2 read model returns canonical status without financial fallback');
select is((public.customer_master_list_v2('2026-02-15T00:00:00Z'::timestamptz) -> 'sourceSnapshot' ->> 'id')::uuid, (select id from public.customer_master_snapshots where import_batch_id=(select batch_id from package02_state where label='second')), 'customer list response carries its exact source snapshot');
select is(jsonb_array_length(public.customer_master_list_v2('2025-12-01T00:00:00Z'::timestamptz) -> 'items'), 0, 'customer list does not leak identities before the first effective master snapshot');
select is(public.customer_master_organization_v2('REPS', '2026-02-15T00:00:00Z'::timestamptz, 'FINANCIAL') -> 'coverage' ->> 'status', 'UNAVAILABLE_DEPENDENCY', 'financial organization scope is explicit until its financial dependency exists');
insert into package02_state(label, batch_id)
select 'backdated', (public.initiate_import_batch('CUSTOMER_MASTER', 'anonymous-master-backdated.xlsx', 32, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', repeat('0',64),
  '{"source":"anonymous"}'::jsonb, 'CUSTOMER_MASTER:anonymous', 'customer-master-init-03', repeat('1',64)) ->> 'batchId')::uuid;
select public.complete_import_upload((select batch_id from package02_state where label='backdated'), repeat('0',64), 32);
select public.parse_customer_master_batch((select batch_id from package02_state where label='backdated'), jsonb_build_array(
  jsonb_build_object('sheetName','Master','sourceRowNumber',2,'rawCells','{"A2":{"rawValue":"5000000001","sourceType":"string"}}'::jsonb,'rowHash',repeat('6',64),'customerCodeCandidate','5000000001','customerCodeValid',true,'parsedPayload','{"customerName":"Anonim Market","storeName":"Anonim Tabela","salesRep":"Rep Alpha","distSalesChief":"SSM Alpha","channel":"Standart Açık","segment":"Diamond","customerStatus":"Aktif"}'::jsonb,'parserWarnings','[]'::jsonb)
), 'customer-master-v2/2.0.0');
select public.validate_customer_master_batch((select batch_id from package02_state where label='backdated'));
update package02_state set validation_run_id=(select active_validation_run_id from public.import_batches where id=batch_id) where label='backdated';
select throws_ok($$select public.publish_customer_master_batch((select batch_id from package02_state where label='backdated'), (select validation_run_id from package02_state where label='backdated'), 3, 'customer-master-backdated', repeat('2',64), '2026-01-01T00:00:00Z'::timestamptz)$$, '55000', 'BACKDATED_MASTER_REVIEW', 'backdated master publication never rewrites history silently');
select * from finish();
rollback;

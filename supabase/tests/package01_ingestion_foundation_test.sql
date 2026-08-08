begin;
select plan(22);

create temporary table package01_state (
  label text primary key,
  batch_id uuid,
  validation_run_id uuid,
  snapshot_id uuid
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated',
  'package01-anonymous@example.test', 'not-a-real-password', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

insert into public.app_user_capabilities (user_id, capability)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', capability
from unnest(array['import.view', 'import.create', 'import.validate', 'import.review', 'import.publish', 'import.audit']) capability;

insert into public.source_contract_versions (
  source_kind, contract_version, header_signature, required_fields, parser_name,
  parser_version, effective_from, status, publication_mode, empty_snapshot_allowed, created_by
) values (
  'SYNTHETIC_TEST', 1, 'synthetic-v1', '["sourceRecordKey"]'::jsonb, 'package01-test-adapter',
  '1.0.0', now() - interval '1 hour', 'ACTIVE', 'FULL_REPLACE', false,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

insert into package01_state (label, batch_id)
select 'first', (public.initiate_import_batch(
  'SYNTHETIC_TEST', 'anonymous.xlsx', 32,
  'application/octet-stream', repeat('a', 64),
  '{"dealerRef":"ANON_DEALER_0001","period":"2025-01"}'::jsonb,
  'SYNTHETIC_TEST:anonymous-2025-01', 'init-first-0001', repeat('b', 64)
) ->> 'batchId')::uuid;

select is(
  (public.initiate_import_batch(
    'SYNTHETIC_TEST', 'anonymous.xlsx', 32,
    'application/octet-stream', repeat('a', 64),
    '{"dealerRef":"ANON_DEALER_0001","period":"2025-01"}'::jsonb,
    'SYNTHETIC_TEST:anonymous-2025-01', 'init-first-0001', repeat('b', 64)
  ) ->> 'batchId')::uuid,
  (select batch_id from package01_state where label = 'first'),
  'same idempotency key and body returns the original batch'
);

select throws_ok(
  $$select public.initiate_import_batch(
    'SYNTHETIC_TEST', 'changed.xlsx', 32, 'application/octet-stream', repeat('a', 64),
    '{"dealerRef":"ANON_DEALER_0001","period":"2025-01"}'::jsonb,
    'SYNTHETIC_TEST:anonymous-2025-01', 'init-first-0001', repeat('c', 64)
  )$$,
  'P0001', 'IDEMPOTENCY_CONFLICT',
  'same idempotency key with a different body conflicts'
);

select is(
  public.complete_import_upload((select batch_id from package01_state where label = 'first'), repeat('a', 64), 32) ->> 'status',
  'HASH_VERIFIED',
  'server hash and byte count verify before parsing'
);

select public.package01_stage_synthetic_batch_for_test(
  (select batch_id from package01_state where label = 'first'),
  jsonb_build_array(jsonb_build_object(
    'sheetName', 'Synthetic',
    'sourceRowNumber', 1,
    'rawCells', jsonb_build_object(
      'A1', jsonb_build_object('address', 'A1', 'columnIndex', 1, 'rawValue', '0000123', 'displayValue', '0000123', 'sourceType', 'string'),
      'B1', jsonb_build_object('address', 'B1', 'columnIndex', 2, 'rawValue', '-1.25', 'displayValue', '-1,25', 'sourceType', 'string'),
      'C1', jsonb_build_object('address', 'C1', 'columnIndex', 3, 'rawValue', '01.02.2025', 'displayValue', '01.02.2025', 'sourceType', 'string')
    ),
    'rowHash', repeat('d', 64),
    'sourceRecordKey', 'ANON-0001',
    'recordFingerprint', repeat('e', 64),
    'stagingPayload', jsonb_build_object('syntheticOnly', true)
  ))
);

select is(
  (select raw_cells #>> '{A1,rawValue}' from public.raw_source_rows where import_batch_id = (select batch_id from package01_state where label = 'first')),
  '0000123', 'leading-zero identity is retained in raw payload'
);
select is(
  (select raw_cells #>> '{B1,displayValue}' from public.raw_source_rows where import_batch_id = (select batch_id from package01_state where label = 'first')),
  '-1,25', 'negative local money display is retained in raw payload'
);
select is(
  (select raw_cells #>> '{C1,rawValue}' from public.raw_source_rows where import_batch_id = (select batch_id from package01_state where label = 'first')),
  '01.02.2025', 'local date display is retained in raw payload'
);
select throws_ok(
  $$update public.raw_source_rows set sheet_name = 'changed' where import_batch_id = (select batch_id from package01_state where label = 'first')$$,
  '55000', 'IMMUTABLE_RECORD', 'raw rows are append-only'
);
select throws_ok(
  $$delete from public.import_state_events where import_batch_id = (select batch_id from package01_state where label = 'first')$$,
  '55000', 'IMMUTABLE_RECORD', 'state events are append-only'
);
select throws_ok(
  $$delete from public.source_record_versions where import_batch_id = (select batch_id from package01_state where label = 'first')$$,
  '55000', 'IMMUTABLE_RECORD', 'record corrections require a new version'
);

update package01_state
set validation_run_id = public.package01_complete_validation_for_test(batch_id)
where label = 'first';

select is(
  public.publish_import(
    (select batch_id from package01_state where label = 'first'),
    (select validation_run_id from package01_state where label = 'first'),
    0, 'publish-first-0001', repeat('f', 64)
  ) ->> 'status',
  'PUBLISHED', 'first validated full snapshot publishes atomically'
);

update package01_state
set snapshot_id = (
  select id from public.publication_snapshots
  where import_batch_id = package01_state.batch_id and is_active
)
where label = 'first';

select is((select count(*)::integer from public.publication_snapshots where is_active), 1, 'only one active snapshot exists for a scope');
select throws_ok(
  $$update public.publication_snapshots set published_at = now() where is_active$$,
  '55000', 'PUBLICATION_SNAPSHOT_IMMUTABLE', 'published snapshot metadata is immutable'
);

insert into package01_state (label, batch_id)
select 'duplicate', (public.initiate_import_batch(
  'SYNTHETIC_TEST', 'anonymous-copy.xlsx', 32,
  'application/octet-stream', repeat('a', 64),
  '{"dealerRef":"ANON_DEALER_0001","period":"2025-01"}'::jsonb,
  'SYNTHETIC_TEST:anonymous-2025-01', 'init-duplicate-0001', repeat('1', 64)
) ->> 'batchId')::uuid;

select is(
  public.complete_import_upload((select batch_id from package01_state where label = 'duplicate'), repeat('a', 64), 32) ->> 'status',
  'DUPLICATE', 'same source, scope, hash and contract creates no second economic snapshot'
);

insert into package01_state (label, batch_id)
select 'blocked', (public.initiate_import_batch(
  'SYNTHETIC_TEST', 'blocked.xlsx', 33,
  'application/octet-stream', repeat('2', 64),
  '{"dealerRef":"ANON_DEALER_0001","period":"2025-01"}'::jsonb,
  'SYNTHETIC_TEST:anonymous-2025-01', 'init-blocked-0001', repeat('3', 64)
) ->> 'batchId')::uuid;
select public.complete_import_upload((select batch_id from package01_state where label = 'blocked'), repeat('2', 64), 33);
select public.package01_stage_synthetic_batch_for_test(
  (select batch_id from package01_state where label = 'blocked'),
  jsonb_build_array(jsonb_build_object(
    'sheetName', 'Synthetic', 'sourceRowNumber', 1,
    'rawCells', jsonb_build_object('A1', jsonb_build_object('rawValue', '0000456', 'displayValue', '0000456', 'sourceType', 'string')),
    'rowHash', repeat('4', 64), 'sourceRecordKey', 'ANON-0002',
    'recordFingerprint', repeat('5', 64), 'stagingPayload', '{}'::jsonb
  ))
);
update package01_state
set validation_run_id = public.package01_complete_validation_for_test(
  batch_id, false,
  jsonb_build_array(jsonb_build_object('severity', 'BLOCKING', 'blocksPublication', true, 'messageKey', 'imports.synthetic.blocking'))
)
where label = 'blocked';
select throws_ok(
  $$select public.publish_import(
    (select batch_id from package01_state where label = 'blocked'),
    (select validation_run_id from package01_state where label = 'blocked'),
    1, 'publish-blocked-0001', repeat('6', 64)
  )$$,
  'P0001', 'BLOCKING_VALIDATION_ISSUES', 'blocking issue preserves previous active snapshot'
);
select is((select id from public.publication_snapshots where is_active), (select snapshot_id from package01_state where label = 'first'), 'failed publish leaves the previous active snapshot intact');

select is(has_table_privilege('anon', 'public.import_batches', 'select'), false, 'anon cannot read import batches');
select is(has_table_privilege('authenticated', 'public.import_batches', 'insert'), false, 'authenticated cannot directly insert import batches');
select is((select relrowsecurity from pg_class where oid = 'public.import_batches'::regclass), true, 'import batches have RLS enabled');
select is((select public.has_capability(auth.uid(), 'import.publish')), true, 'capability helper uses the authenticated actor');
select is((select count(*)::integer from public.source_record_version_raw_rows), 2, 'raw row to record version provenance is relational and complete');
select is((select count(*)::integer from public.import_state_events where import_batch_id = (select batch_id from package01_state where label = 'first')), 9, 'state transitions are append-only provenance');
select is((select status::text from public.import_batches where id = (select batch_id from package01_state where label = 'duplicate')), 'DUPLICATE', 'terminal duplicate batch cannot enter publish state');

select * from finish();
rollback;

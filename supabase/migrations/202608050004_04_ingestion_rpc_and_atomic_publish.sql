-- Package 01: narrow capability-checked mutation surface.

create or replace function public.require_import_capability(p_capability text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_capability(auth.uid(), p_capability) then
    raise exception 'CAPABILITY_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.assert_import_idempotency(
  p_endpoint text,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.import_request_idempotency
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.import_request_idempotency;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':' || p_endpoint || ':' || p_idempotency_key, 0)
  );

  select * into v_existing
  from public.import_request_idempotency
  where actor_id = auth.uid()
    and endpoint = p_endpoint
    and idempotency_key = p_idempotency_key
  for update;

  if found and v_existing.request_fingerprint <> p_request_fingerprint then
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;

  return v_existing;
end;
$$;

create or replace function public.initiate_import_batch(
  p_source_kind text,
  p_original_file_name text,
  p_declared_byte_size bigint,
  p_mime_type text,
  p_declared_sha256 text,
  p_scope_payload jsonb,
  p_scope_key text,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract public.source_contract_versions;
  v_idempotency public.import_request_idempotency;
  v_batch public.import_batches;
  v_batch_id uuid := gen_random_uuid();
  v_object_path text := 'imports/' || v_batch_id::text || '/' || gen_random_uuid()::text;
begin
  perform public.require_import_capability('import.create');

  select * into v_idempotency
  from public.assert_import_idempotency('imports.initiate', p_idempotency_key, p_request_fingerprint);

  if v_idempotency.id is not null then
    select * into v_batch from public.import_batches where id = v_idempotency.import_batch_id;
    return jsonb_build_object(
      'batchId', v_batch.id,
      'status', v_batch.status,
      'storageObjectPath', v_batch.storage_object_path,
      'idempotentReplay', true
    );
  end if;

  select * into v_contract
  from public.source_contract_versions
  where source_kind = p_source_kind
    and status = 'ACTIVE'
    and effective_from <= now()
    and (effective_to is null or effective_to > now())
  order by contract_version desc
  limit 1;

  if not found then
    raise exception 'SOURCE_CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.import_batches (
    id, source_kind, source_contract_version_id, scope_key, scope_payload,
    idempotency_key, request_fingerprint, declared_sha256, declared_byte_size,
    original_file_name, mime_type, storage_object_path, created_by
  ) values (
    v_batch_id, p_source_kind, v_contract.id, p_scope_key, p_scope_payload,
    p_idempotency_key, p_request_fingerprint, p_declared_sha256, p_declared_byte_size,
    p_original_file_name, p_mime_type, v_object_path, auth.uid()
  ) returning * into v_batch;

  insert into public.import_state_events (
    import_batch_id, previous_status, new_status, actor_id, reason_code
  ) values (v_batch.id, null, 'INITIATED', auth.uid(), 'IMPORT_INITIATED');

  insert into public.import_request_idempotency (
    actor_id, endpoint, idempotency_key, request_fingerprint, import_batch_id,
    response_payload
  ) values (
    auth.uid(), 'imports.initiate', p_idempotency_key, p_request_fingerprint, v_batch.id,
    jsonb_build_object('batchId', v_batch.id, 'status', v_batch.status)
  );

  return jsonb_build_object(
    'batchId', v_batch.id,
    'status', v_batch.status,
    'storageObjectPath', v_batch.storage_object_path,
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.complete_import_upload(
  p_batch_id uuid,
  p_server_sha256 text,
  p_server_byte_size bigint,
  p_request_id uuid default gen_random_uuid(),
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_source_file_id uuid;
  v_duplicate_batch_id uuid;
begin
  perform public.require_import_capability('import.create');

  select * into v_batch
  from public.import_batches
  where id = p_batch_id and created_by = auth.uid()
  for update;

  if not found then
    raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_batch.status in ('HASH_VERIFIED', 'DUPLICATE', 'PARSED', 'VALIDATING', 'VALIDATED', 'REVIEW_REQUIRED', 'APPROVED', 'PUBLISHING', 'PUBLISHED') then
    return jsonb_build_object(
      'batchId', v_batch.id,
      'status', v_batch.status,
      'duplicateOfBatchId', v_batch.duplicate_of_batch_id,
      'idempotentReplay', true
    );
  end if;

  if v_batch.status <> 'INITIATED' then
    raise exception 'INVALID_IMPORT_STATE_TRANSITION' using errcode = '55000';
  end if;

  perform public.transition_import_batch(
    v_batch.id, 'UPLOADED', 'STORAGE_OBJECT_VERIFIED', p_request_id, p_correlation_id
  );

  if p_server_sha256 <> v_batch.declared_sha256
     or p_server_byte_size <> v_batch.declared_byte_size then
    perform public.transition_import_batch(
      v_batch.id, 'FAILED', 'HASH_OR_SIZE_MISMATCH', p_request_id, p_correlation_id,
      jsonb_build_object('serverSha256', p_server_sha256, 'serverByteSize', p_server_byte_size)
    );
    return jsonb_build_object(
      'batchId', v_batch.id,
      'status', 'FAILED',
      'code', 'HASH_OR_SIZE_MISMATCH',
      'idempotentReplay', false
    );
  end if;

  insert into public.source_files (
    sha256, byte_size, mime_type, storage_object_path, original_file_name, uploaded_by
  ) values (
    p_server_sha256, p_server_byte_size, v_batch.mime_type, v_batch.storage_object_path,
    v_batch.original_file_name, auth.uid()
  ) on conflict (sha256, byte_size) do nothing;

  select id into v_source_file_id
  from public.source_files
  where sha256 = p_server_sha256 and byte_size = p_server_byte_size;

  update public.import_batches
  set source_file_id = v_source_file_id
  where id = v_batch.id;

  perform public.transition_import_batch(
    v_batch.id, 'HASH_VERIFIED', 'SERVER_HASH_VERIFIED', p_request_id, p_correlation_id
  );

  select b.id into v_duplicate_batch_id
  from public.import_batches b
  where b.id <> v_batch.id
    and b.source_kind = v_batch.source_kind
    and b.scope_key = v_batch.scope_key
    and b.source_file_id = v_source_file_id
    and b.source_contract_version_id = v_batch.source_contract_version_id
    and b.status = 'PUBLISHED'
  order by b.created_at desc
  limit 1;

  if v_duplicate_batch_id is not null then
    update public.import_batches
    set duplicate_of_batch_id = v_duplicate_batch_id
    where id = v_batch.id;
    perform public.transition_import_batch(
      v_batch.id, 'DUPLICATE', 'PUBLISHED_DUPLICATE_FOUND', p_request_id, p_correlation_id,
      jsonb_build_object('duplicateOfBatchId', v_duplicate_batch_id)
    );
    return jsonb_build_object(
      'batchId', v_batch.id,
      'status', 'DUPLICATE',
      'duplicateOfBatchId', v_duplicate_batch_id,
      'idempotentReplay', false
    );
  end if;

  return jsonb_build_object(
    'batchId', v_batch.id,
    'status', 'HASH_VERIFIED',
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.start_import_validation(
  p_batch_id uuid,
  p_request_id uuid default gen_random_uuid(),
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_run public.validation_runs;
begin
  perform public.require_import_capability('import.validate');

  select * into v_batch
  from public.import_batches
  where id = p_batch_id and created_by = auth.uid()
  for update;

  if not found then
    raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'PARSED' then
    raise exception 'PARSER_NOT_COMPLETED' using errcode = '55000';
  end if;

  perform public.transition_import_batch(
    p_batch_id, 'VALIDATING', 'VALIDATION_STARTED', p_request_id, p_correlation_id
  );
  insert into public.validation_runs (
    import_batch_id, status, source_contract_version_id, created_by
  ) values (
    p_batch_id, 'RUNNING', v_batch.source_contract_version_id, auth.uid()
  ) returning * into v_run;

  update public.import_batches
  set active_validation_run_id = v_run.id
  where id = p_batch_id;

  return jsonb_build_object('batchId', p_batch_id, 'validationRunId', v_run.id, 'status', 'VALIDATING');
end;
$$;

create or replace function public.review_import_batch(
  p_batch_id uuid,
  p_decision text,
  p_reason text,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_request_id uuid default gen_random_uuid(),
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_idempotency public.import_request_idempotency;
  v_target_status public.import_batch_status;
begin
  perform public.require_import_capability('import.review');
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'REVIEW_REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_decision not in ('APPROVE', 'REJECT') then
    raise exception 'INVALID_REVIEW_DECISION' using errcode = '22023';
  end if;

  select * into v_idempotency
  from public.assert_import_idempotency('imports.review', p_idempotency_key, p_request_fingerprint);
  if v_idempotency.id is not null then
    select * into v_batch from public.import_batches where id = v_idempotency.import_batch_id;
    return jsonb_build_object('batchId', v_batch.id, 'status', v_batch.status, 'idempotentReplay', true);
  end if;

  select * into v_batch from public.import_batches
  where id = p_batch_id and created_by = auth.uid()
  for update;
  if not found then
    raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'REVIEW_REQUIRED' then
    raise exception 'REVIEW_NOT_ALLOWED' using errcode = '55000';
  end if;

  v_target_status := case p_decision when 'APPROVE' then 'APPROVED' else 'REJECTED' end;
  perform public.transition_import_batch(
    p_batch_id, v_target_status, 'REVIEW_' || p_decision, p_request_id, p_correlation_id,
    jsonb_build_object('reason', p_reason)
  );
  insert into public.import_request_idempotency (
    actor_id, endpoint, idempotency_key, request_fingerprint, import_batch_id, response_payload
  ) values (
    auth.uid(), 'imports.review', p_idempotency_key, p_request_fingerprint, p_batch_id,
    jsonb_build_object('batchId', p_batch_id, 'status', v_target_status)
  );
  return jsonb_build_object('batchId', p_batch_id, 'status', v_target_status, 'idempotentReplay', false);
end;
$$;

create or replace function public.publish_import(
  p_batch_id uuid,
  p_expected_validation_run_id uuid,
  p_expected_snapshot_version integer,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_request_id uuid default gen_random_uuid(),
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_run public.validation_runs;
  v_contract public.source_contract_versions;
  v_idempotency public.import_request_idempotency;
  v_previous_snapshot public.publication_snapshots;
  v_snapshot public.publication_snapshots;
  v_current_snapshot_version integer;
  v_item_count integer;
begin
  perform public.require_import_capability('import.publish');
  select * into v_idempotency
  from public.assert_import_idempotency('imports.publish', p_idempotency_key, p_request_fingerprint);
  if v_idempotency.id is not null then
    return v_idempotency.response_payload || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_batch
  from public.import_batches
  where id = p_batch_id and created_by = auth.uid()
  for update;
  if not found then
    raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_batch.status not in ('VALIDATED', 'APPROVED') then
    raise exception 'PUBLISH_NOT_ALLOWED' using errcode = '55000';
  end if;
  if v_batch.active_validation_run_id is distinct from p_expected_validation_run_id then
    raise exception 'STALE_VALIDATION_RUN' using errcode = 'P0001';
  end if;

  select * into v_run
  from public.validation_runs
  where id = p_expected_validation_run_id and import_batch_id = p_batch_id;
  if not found or v_run.status <> 'SUCCEEDED' then
    raise exception 'VALIDATION_NOT_SUCCEEDED' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.data_quality_issues q
    where q.validation_run_id = v_run.id and q.blocks_publication
  ) then
    raise exception 'BLOCKING_VALIDATION_ISSUES' using errcode = 'P0001';
  end if;
  if coalesce((v_run.control_totals ->> 'readRowCount')::integer, -1) <> v_batch.read_row_count
     or coalesce((v_run.control_totals ->> 'validRowCount')::integer, -1) <> v_batch.valid_row_count
     or coalesce((v_run.control_totals ->> 'invalidRowCount')::integer, -1) <> v_batch.invalid_row_count then
    raise exception 'VALIDATION_CONTROL_TOTAL_MISMATCH' using errcode = 'P0001';
  end if;

  select * into v_contract from public.source_contract_versions where id = v_batch.source_contract_version_id;
  if not found then
    raise exception 'SOURCE_CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_batch.source_kind || ':' || v_batch.scope_key, 0));
  select * into v_previous_snapshot
  from public.publication_snapshots
  where source_kind = v_batch.source_kind and scope_key = v_batch.scope_key and is_active
  for update;
  v_current_snapshot_version := coalesce(v_previous_snapshot.snapshot_version, 0);
  if p_expected_snapshot_version <> v_current_snapshot_version then
    raise exception 'STALE_ACTIVE_SNAPSHOT' using errcode = 'P0001';
  end if;

  select count(*) into v_item_count
  from public.source_record_versions
  where import_batch_id = p_batch_id;
  if v_item_count = 0 and not v_contract.empty_snapshot_allowed then
    raise exception 'EMPTY_SNAPSHOT_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  perform public.transition_import_batch(
    p_batch_id, 'PUBLISHING', 'PUBLICATION_STARTED', p_request_id, p_correlation_id
  );

  if v_previous_snapshot.id is not null then
    perform set_config('app.import_publish', 'on', true);
    update public.publication_snapshots set is_active = false where id = v_previous_snapshot.id;
  end if;

  insert into public.publication_snapshots (
    source_kind, scope_key, import_batch_id, validation_run_id, snapshot_version,
    is_active, published_by, previous_snapshot_id, control_totals
  ) values (
    v_batch.source_kind, v_batch.scope_key, p_batch_id, v_run.id, v_current_snapshot_version + 1,
    true, auth.uid(), v_previous_snapshot.id, v_run.control_totals
  ) returning * into v_snapshot;

  if v_contract.publication_mode = 'FULL_REPLACE' then
    insert into public.publication_snapshot_items (publication_snapshot_id, source_record_version_id)
    select v_snapshot.id, id
    from public.source_record_versions
    where import_batch_id = p_batch_id;
  elsif v_contract.publication_mode = 'APPEND_ONLY' then
    insert into public.publication_snapshot_items (publication_snapshot_id, source_record_version_id)
    select v_snapshot.id, source_record_version_id
    from public.publication_snapshot_items
    where publication_snapshot_id = v_previous_snapshot.id
    union
    select v_snapshot.id, id
    from public.source_record_versions
    where import_batch_id = p_batch_id;
  elsif v_contract.publication_mode = 'UPSERT_VERSIONED' then
    insert into public.publication_snapshot_items (publication_snapshot_id, source_record_version_id)
    select v_snapshot.id, ranked.id
    from (
      select distinct on (v.source_kind, v.source_record_key) v.id
      from public.source_record_versions v
      where v.id in (
        select i.source_record_version_id
        from public.publication_snapshot_items i
        where i.publication_snapshot_id = v_previous_snapshot.id
        union
        select id from public.source_record_versions where import_batch_id = p_batch_id
      )
      order by v.source_kind, v.source_record_key, v.version_no desc, v.created_at desc
    ) ranked;
  else
    raise exception 'PUBLICATION_MODE_REQUIRED' using errcode = '55000';
  end if;

  perform public.transition_import_batch(
    p_batch_id, 'PUBLISHED', 'PUBLICATION_COMPLETED', p_request_id, p_correlation_id,
    jsonb_build_object('publicationSnapshotId', v_snapshot.id, 'snapshotVersion', v_snapshot.snapshot_version)
  );
  insert into public.import_request_idempotency (
    actor_id, endpoint, idempotency_key, request_fingerprint, import_batch_id,
    publication_snapshot_id, response_payload
  ) values (
    auth.uid(), 'imports.publish', p_idempotency_key, p_request_fingerprint, p_batch_id,
    v_snapshot.id, jsonb_build_object(
      'batchId', p_batch_id,
      'publicationSnapshotId', v_snapshot.id,
      'snapshotVersion', v_snapshot.snapshot_version,
      'status', 'PUBLISHED'
    )
  );
  return jsonb_build_object(
    'batchId', p_batch_id,
    'publicationSnapshotId', v_snapshot.id,
    'snapshotVersion', v_snapshot.snapshot_version,
    'status', 'PUBLISHED',
    'idempotentReplay', false
  );
end;
$$;

-- This adapter is deliberately not granted to application roles.  It exists solely for
-- Package 01 local SQL characterization: it proves the generic immutable pipeline
-- without introducing a production Excel parser ahead of the relevant source package.
create or replace function public.package01_stage_synthetic_batch_for_test(
  p_batch_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_row jsonb;
  v_raw_row_id uuid;
  v_source_record_version_id uuid;
  v_count integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'SYNTHETIC_ROWS_MUST_BE_ARRAY' using errcode = '22023';
  end if;
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found or v_batch.source_kind <> 'SYNTHETIC_TEST' then
    raise exception 'SYNTHETIC_ADAPTER_FORBIDDEN' using errcode = '42501';
  end if;
  if v_batch.status <> 'HASH_VERIFIED' then
    raise exception 'PARSER_NOT_COMPLETED' using errcode = '55000';
  end if;

  perform public.transition_import_batch(p_batch_id, 'PARSING', 'SYNTHETIC_TEST_PARSE_STARTED');
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if coalesce((v_row ->> 'sheetName'), '') = ''
       or coalesce((v_row ->> 'sourceRowNumber'), '') !~ '^[1-9][0-9]*$'
       or jsonb_typeof(v_row -> 'rawCells') <> 'object'
       or coalesce((v_row ->> 'rowHash'), '') !~ '^[0-9a-f]{64}$'
       or coalesce((v_row ->> 'sourceRecordKey'), '') = ''
       or coalesce((v_row ->> 'recordFingerprint'), '') !~ '^[0-9a-f]{64}$'
       or jsonb_typeof(v_row -> 'stagingPayload') <> 'object' then
      raise exception 'INVALID_SYNTHETIC_ROW' using errcode = '22023';
    end if;

    insert into public.raw_source_rows (
      import_batch_id, sheet_name, source_row_number, raw_cells, row_hash
    ) values (
      p_batch_id, v_row ->> 'sheetName', (v_row ->> 'sourceRowNumber')::integer,
      v_row -> 'rawCells', v_row ->> 'rowHash'
    ) returning id into v_raw_row_id;

    insert into public.source_record_versions (
      source_kind, source_record_key, version_no, record_fingerprint, staging_payload,
      import_batch_id, created_by
    ) values (
      v_batch.source_kind, v_row ->> 'sourceRecordKey', 1, v_row ->> 'recordFingerprint',
      v_row -> 'stagingPayload', p_batch_id, v_batch.created_by
    ) returning id into v_source_record_version_id;

    insert into public.source_record_version_raw_rows (source_record_version_id, raw_source_row_id)
    values (v_source_record_version_id, v_raw_row_id);
    v_count := v_count + 1;
  end loop;

  update public.import_batches
  set read_row_count = v_count, valid_row_count = v_count, invalid_row_count = 0
  where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED', 'SYNTHETIC_TEST_PARSE_COMPLETED');
end;
$$;

create or replace function public.package01_complete_validation_for_test(
  p_batch_id uuid,
  p_requires_review boolean default false,
  p_issues jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_run public.validation_runs;
  v_issue jsonb;
begin
  if jsonb_typeof(p_issues) <> 'array' then
    raise exception 'SYNTHETIC_ISSUES_MUST_BE_ARRAY' using errcode = '22023';
  end if;
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found or v_batch.source_kind <> 'SYNTHETIC_TEST' or v_batch.status <> 'PARSED' then
    raise exception 'SYNTHETIC_VALIDATION_FORBIDDEN' using errcode = '42501';
  end if;

  perform public.transition_import_batch(p_batch_id, 'VALIDATING', 'SYNTHETIC_TEST_VALIDATION_STARTED');
  insert into public.validation_runs (
    import_batch_id, status, source_contract_version_id, created_by
  ) values (p_batch_id, 'RUNNING', v_batch.source_contract_version_id, v_batch.created_by)
  returning * into v_run;

  for v_issue in select value from jsonb_array_elements(p_issues) loop
    insert into public.data_quality_issues (
      validation_run_id, severity, blocks_publication, message_key, details, affected_field, source_ref
    ) values (
      v_run.id, (v_issue ->> 'severity')::public.import_issue_severity,
      coalesce((v_issue ->> 'blocksPublication')::boolean, false),
      coalesce(v_issue ->> 'messageKey', 'imports.synthetic.issue'),
      coalesce(v_issue -> 'details', '{}'::jsonb),
      v_issue ->> 'affectedField', v_issue -> 'sourceRef'
    );
  end loop;

  perform set_config('app.import_validation_transition', 'on', true);
  update public.validation_runs
  set status = 'SUCCEEDED',
      finished_at = now(),
      control_totals = jsonb_build_object(
        'readRowCount', v_batch.read_row_count,
        'validRowCount', v_batch.valid_row_count,
        'invalidRowCount', v_batch.invalid_row_count
      )
  where id = v_run.id;
  update public.import_batches set active_validation_run_id = v_run.id where id = p_batch_id;
  perform public.transition_import_batch(
    p_batch_id,
    (case when p_requires_review then 'REVIEW_REQUIRED' else 'VALIDATED' end)::public.import_batch_status,
    'SYNTHETIC_TEST_VALIDATION_COMPLETED'
  );
  return v_run.id;
end;
$$;

revoke all on function public.require_import_capability(text) from public, anon;
revoke all on function public.assert_import_idempotency(text, text, text) from public, anon;
revoke all on function public.initiate_import_batch(text, text, bigint, text, text, jsonb, text, text, text) from public, anon;
revoke all on function public.complete_import_upload(uuid, text, bigint, uuid, text) from public, anon;
revoke all on function public.start_import_validation(uuid, uuid, text) from public, anon;
revoke all on function public.review_import_batch(uuid, text, text, text, text, uuid, text) from public, anon;
revoke all on function public.publish_import(uuid, uuid, integer, text, text, uuid, text) from public, anon;
revoke all on function public.package01_stage_synthetic_batch_for_test(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.package01_complete_validation_for_test(uuid, boolean, jsonb) from public, anon, authenticated;

grant execute on function public.initiate_import_batch(text, text, bigint, text, text, jsonb, text, text, text) to authenticated;
grant execute on function public.complete_import_upload(uuid, text, bigint, uuid, text) to authenticated;
grant execute on function public.start_import_validation(uuid, uuid, text) to authenticated;
grant execute on function public.review_import_batch(uuid, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.publish_import(uuid, uuid, integer, text, text, uuid, text) to authenticated;

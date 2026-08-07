-- Package 02: deterministic customer-master parsing, resolution and read RPCs.

create or replace function public.customer_master_normalize_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g')), '');
$$;

create or replace function public.require_customer_master_capability(p_capability text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_capability(auth.uid(), p_capability) then
    raise exception 'CUSTOMER_MASTER_CAPABILITY_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.parse_customer_master_batch(
  p_batch_id uuid,
  p_rows jsonb,
  p_parser_version text,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_row jsonb;
  v_raw_row_id uuid;
  v_record_id uuid;
  v_read_count integer := 0;
begin
  perform public.require_customer_master_capability('import.create');
  if jsonb_typeof(p_rows) <> 'array' or btrim(coalesce(p_parser_version, '')) = '' then
    raise exception 'INVALID_CUSTOMER_MASTER_PARSE_REQUEST' using errcode = '22023';
  end if;
  select * into v_batch from public.import_batches where id = p_batch_id and created_by = auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'CUSTOMER_MASTER' then raise exception 'SOURCE_KIND_MISMATCH' using errcode = '22023'; end if;
  if v_batch.status <> 'HASH_VERIFIED' then raise exception 'PARSER_NOT_ALLOWED' using errcode = '55000'; end if;

  perform public.transition_import_batch(p_batch_id, 'PARSING'::public.import_batch_status, 'CUSTOMER_MASTER_PARSE_STARTED', gen_random_uuid(), p_correlation_id);
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if coalesce(v_row ->> 'sheetName', '') = ''
      or coalesce(v_row ->> 'sourceRowNumber', '') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(v_row -> 'rawCells') <> 'object'
      or coalesce(v_row ->> 'rowHash', '') !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(v_row -> 'parsedPayload') <> 'object'
      or jsonb_typeof(coalesce(v_row -> 'parserWarnings', '[]'::jsonb)) <> 'array' then
      raise exception 'INVALID_CUSTOMER_MASTER_ROW' using errcode = '22023';
    end if;
    insert into public.raw_source_rows (import_batch_id, sheet_name, source_row_number, raw_cells, row_hash)
    values (p_batch_id, v_row ->> 'sheetName', (v_row ->> 'sourceRowNumber')::integer, v_row -> 'rawCells', v_row ->> 'rowHash')
    returning id into v_raw_row_id;
    insert into public.source_record_versions (
      source_kind, source_record_key, version_no, record_fingerprint, staging_payload, import_batch_id, created_by
    ) values (
      'CUSTOMER_MASTER', p_batch_id::text || ':' || (v_row ->> 'sheetName') || ':' || (v_row ->> 'sourceRowNumber'),
      1, v_row ->> 'rowHash', v_row -> 'parsedPayload', p_batch_id, auth.uid()
    ) returning id into v_record_id;
    insert into public.source_record_version_raw_rows (source_record_version_id, raw_source_row_id)
    values (v_record_id, v_raw_row_id);
    insert into public.customer_master_row_observations (
      import_batch_id, source_record_version_id, raw_source_row_id, sheet_name, source_row_number,
      customer_code_candidate, customer_code_valid, parsed_payload, parser_warnings
    ) values (
      p_batch_id, v_record_id, v_raw_row_id, v_row ->> 'sheetName', (v_row ->> 'sourceRowNumber')::integer,
      nullif(v_row ->> 'customerCodeCandidate', ''), coalesce((v_row ->> 'customerCodeValid')::boolean, false),
      v_row -> 'parsedPayload', coalesce(v_row -> 'parserWarnings', '[]'::jsonb)
    );
    v_read_count := v_read_count + 1;
  end loop;
  update public.import_batches set read_row_count = v_read_count, valid_row_count = 0, invalid_row_count = 0 where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED'::public.import_batch_status, 'CUSTOMER_MASTER_PARSE_COMPLETED', gen_random_uuid(), p_correlation_id,
    jsonb_build_object('parserVersion', p_parser_version, 'readRowCount', v_read_count));
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PARSED', 'readRowCount', v_read_count);
end;
$$;

create or replace function public.validate_customer_master_batch(
  p_batch_id uuid,
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
  v_valid_count integer;
  v_invalid_count integer;
  v_unknown_status_count integer;
begin
  perform public.require_customer_master_capability('import.validate');
  select * into v_batch from public.import_batches where id = p_batch_id and created_by = auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'CUSTOMER_MASTER' or v_batch.status <> 'PARSED' then
    raise exception 'CUSTOMER_MASTER_VALIDATION_NOT_ALLOWED' using errcode = '55000';
  end if;
  perform public.transition_import_batch(p_batch_id, 'VALIDATING'::public.import_batch_status, 'CUSTOMER_MASTER_VALIDATION_STARTED', gen_random_uuid(), p_correlation_id);
  insert into public.validation_runs (import_batch_id, status, source_contract_version_id, created_by)
  values (p_batch_id, 'RUNNING', v_batch.source_contract_version_id, auth.uid()) returning * into v_run;
  select count(*) filter (where customer_code_valid), count(*) filter (where not customer_code_valid)
  into v_valid_count, v_invalid_count from public.customer_master_row_observations where import_batch_id = p_batch_id;
  insert into public.data_quality_issues (validation_run_id, severity, blocks_publication, message_key, details, affected_field, source_ref)
  select v_run.id, 'ERROR', false, 'INVALID_CUSTOMER_CODE',
    jsonb_build_object('customerCodeCandidate', customer_code_candidate), 'Müşteri',
    jsonb_build_object('sheetName', sheet_name, 'sourceRowNumber', source_row_number)
  from public.customer_master_row_observations
  where import_batch_id = p_batch_id and not customer_code_valid;
  select count(*) into v_unknown_status_count
  from public.customer_master_row_observations o
  where o.import_batch_id = p_batch_id and o.customer_code_valid
    and public.customer_master_normalize_text(o.parsed_payload ->> 'customerStatus') is not null
    and not exists (
      select 1 from public.customer_status_aliases a
      where a.raw_normalized = public.customer_master_normalize_text(o.parsed_payload ->> 'customerStatus')
        and a.valid_from <= now() and (a.valid_to is null or a.valid_to > now())
    );
  if v_unknown_status_count > 0 then
    insert into public.data_quality_issues (validation_run_id, severity, blocks_publication, message_key, details)
    values (v_run.id, 'WARNING', false, 'UNKNOWN_CUSTOMER_STATUS', jsonb_build_object('rowCount', v_unknown_status_count));
  end if;
  perform set_config('app.import_validation_transition', 'on', true);
  if v_valid_count = 0 then
    insert into public.data_quality_issues (validation_run_id, severity, blocks_publication, message_key, details)
    values (v_run.id, 'BLOCKING', true, 'SOURCE_COVERAGE_INCOMPLETE', jsonb_build_object('reason', 'NO_VALID_500_CUSTOMER_CODE'));
    update public.validation_runs set status = 'FAILED', finished_at = now(), control_totals = jsonb_build_object('readRowCount', v_batch.read_row_count, 'validRowCount', 0, 'invalidRowCount', v_invalid_count) where id = v_run.id;
    update public.import_batches set active_validation_run_id = v_run.id, valid_row_count = 0, invalid_row_count = v_invalid_count where id = p_batch_id;
    perform public.transition_import_batch(p_batch_id, 'FAILED'::public.import_batch_status, 'CUSTOMER_MASTER_VALIDATION_FAILED', gen_random_uuid(), p_correlation_id);
    raise exception 'SOURCE_COVERAGE_INCOMPLETE' using errcode = 'P0001';
  end if;
  update public.validation_runs set status = 'SUCCEEDED', finished_at = now(), control_totals = jsonb_build_object('readRowCount', v_batch.read_row_count, 'validRowCount', v_valid_count, 'invalidRowCount', v_invalid_count, 'unknownStatusRowCount', v_unknown_status_count) where id = v_run.id;
  update public.import_batches set active_validation_run_id = v_run.id, valid_row_count = v_valid_count, invalid_row_count = v_invalid_count where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'VALIDATED'::public.import_batch_status, 'CUSTOMER_MASTER_VALIDATION_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'VALIDATED', 'validationRunId', v_run.id, 'validRowCount', v_valid_count, 'invalidRowCount', v_invalid_count);
end;
$$;

create or replace function public.customer_master_resolve_status(p_batch_id uuid, p_customer_code text, p_as_of timestamptz)
returns public.customer_master_status
language sql
stable
security definer
set search_path = ''
as $$
  with values_by_row as (
    select coalesce((
      select a.canonical_status from public.customer_status_aliases a
      where a.raw_normalized = public.customer_master_normalize_text(o.parsed_payload ->> 'customerStatus')
        and a.valid_from <= p_as_of and (a.valid_to is null or a.valid_to > p_as_of)
      order by a.valid_from desc limit 1
    ), 'UNKNOWN'::public.customer_master_status) as status
    from public.customer_master_row_observations o
    where o.import_batch_id = p_batch_id and o.customer_code_candidate = p_customer_code and o.customer_code_valid
  )
  select case
    when bool_or(status = 'ACTIVE') then 'ACTIVE'::public.customer_master_status
    when bool_or(status = 'PASSIVE') then 'PASSIVE'::public.customer_master_status
    when count(*) > 0 and bool_and(status = 'CANCELLED') then 'CANCELLED'::public.customer_master_status
    else 'UNKNOWN'::public.customer_master_status
  end from values_by_row;
$$;

create or replace function public.publish_customer_master_batch(
  p_batch_id uuid,
  p_expected_validation_run_id uuid,
  p_expected_snapshot_version integer,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_business_effective_at timestamptz default null,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_validation public.validation_runs;
  v_previous public.customer_master_snapshots;
  v_generic_snapshot public.publication_snapshots;
  v_master_snapshot public.customer_master_snapshots;
  v_effective_at timestamptz := coalesce(p_business_effective_at, now());
  v_effective_provenance text := case when p_business_effective_at is null then 'UPLOAD_TIME_FALLBACK' else 'SOURCE_CUTOVER' end;
  v_snapshot_version integer;
  v_customer record;
  v_profile_names text[];
  v_profile_stores text[];
  v_profile_name text;
  v_profile_store text;
  v_channel_values public.customer_channel[];
  v_segment_values text[];
  v_rep_values text[];
  v_channel_id uuid;
  v_segment_id uuid;
  v_rep_id uuid;
  v_resolution public.customer_resolution_state;
  v_issue_count integer := 0;
  v_response jsonb;
  v_idempotency public.import_request_idempotency;
  v_rep record;
  v_ssm_norm text;
  v_ssm_name text;
  v_ssm_id uuid;
  v_ssm_numerator integer;
  v_ssm_denominator integer;
  v_ssm_tie_count integer;
begin
  perform public.require_customer_master_capability('import.publish');
  if btrim(coalesce(p_idempotency_key, '')) = '' or coalesce(p_request_fingerprint, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_IDEMPOTENCY_REQUEST' using errcode = '22023';
  end if;
  select * into v_idempotency from public.import_request_idempotency
  where actor_id = auth.uid() and endpoint = 'customer-master.publish' and idempotency_key = p_idempotency_key;
  if found then
    if v_idempotency.request_fingerprint <> p_request_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001'; end if;
    return v_idempotency.response_payload;
  end if;
  select * into v_batch from public.import_batches where id = p_batch_id and created_by = auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'CUSTOMER_MASTER' or v_batch.status <> 'VALIDATED' then raise exception 'CUSTOMER_MASTER_PUBLISH_NOT_ALLOWED' using errcode = '55000'; end if;
  if v_batch.active_validation_run_id <> p_expected_validation_run_id then raise exception 'STALE_VALIDATION_RUN' using errcode = '40001'; end if;
  select * into v_validation from public.validation_runs where id = p_expected_validation_run_id and import_batch_id = p_batch_id;
  if not found or v_validation.status <> 'SUCCEEDED' then raise exception 'VALIDATION_NOT_SUCCEEDED' using errcode = 'P0001'; end if;
  select * into v_previous from public.customer_master_snapshots where scope_key = v_batch.scope_key and is_current for update;
  if found and v_effective_at <= v_previous.business_effective_at then
    raise exception 'BACKDATED_MASTER_REVIEW' using errcode = '55000';
  end if;
  select coalesce(max(snapshot_version), 0) + 1 into v_snapshot_version from public.publication_snapshots where source_kind = 'CUSTOMER_MASTER' and scope_key = v_batch.scope_key;
  if p_expected_snapshot_version <> v_snapshot_version then raise exception 'STALE_ACTIVE_SNAPSHOT' using errcode = '40001'; end if;

  perform set_config('app.import_publish', 'on', true);
  perform set_config('app.customer_master_publish', 'on', true);
  perform public.transition_import_batch(p_batch_id, 'PUBLISHING'::public.import_batch_status, 'CUSTOMER_MASTER_PUBLICATION_STARTED', gen_random_uuid(), p_correlation_id);
  if found then update public.publication_snapshots set is_active = false where id = v_previous.publication_snapshot_id; end if;
  insert into public.publication_snapshots (source_kind, scope_key, import_batch_id, validation_run_id, snapshot_version, is_active, published_by, previous_snapshot_id, control_totals)
  values ('CUSTOMER_MASTER', v_batch.scope_key, p_batch_id, p_expected_validation_run_id, v_snapshot_version, true, auth.uid(), v_previous.publication_snapshot_id,
    jsonb_build_object('readRowCount', v_batch.read_row_count, 'validRowCount', v_batch.valid_row_count, 'invalidRowCount', v_batch.invalid_row_count))
  returning * into v_generic_snapshot;
  insert into public.publication_snapshot_items (publication_snapshot_id, source_record_version_id)
  select v_generic_snapshot.id, source_record_version_id from public.customer_master_row_observations where import_batch_id = p_batch_id;
  if found then update public.customer_master_snapshots set is_current = false where id = v_previous.id; end if;
  insert into public.customer_master_snapshots (publication_snapshot_id, import_batch_id, source_contract_version_id, scope_key, business_effective_at, effective_at_provenance, status, is_current, previous_snapshot_id, control_totals, published_at, published_by)
  values (v_generic_snapshot.id, p_batch_id, v_batch.source_contract_version_id, v_batch.scope_key, v_effective_at, v_effective_provenance,
    'PUBLISHED', true, v_previous.id, v_generic_snapshot.control_totals, now(), auth.uid()) returning * into v_master_snapshot;
  insert into public.master_resolution_runs (customer_master_snapshot_id, rule_version, status, created_by)
  values (v_master_snapshot.id, 'customer-master-v2/2.0.0', 'RUNNING', auth.uid());

  insert into public.customers (customer_code, created_from_import_batch_id)
  select distinct o.customer_code_candidate, p_batch_id from public.customer_master_row_observations o
  where o.import_batch_id = p_batch_id and o.customer_code_valid
  on conflict (customer_code) do nothing;
  insert into public.customer_snapshot_memberships (customer_master_snapshot_id, customer_id, source_observation_count, provenance)
  select v_master_snapshot.id, c.customer_id, count(*)::integer,
    jsonb_build_object('sourceObservationIds', jsonb_agg(o.id order by o.sheet_name, o.source_row_number))
  from public.customer_master_row_observations o
  join public.customers c on c.customer_code = o.customer_code_candidate
  where o.import_batch_id = p_batch_id and o.customer_code_valid
  group by c.customer_id;

  update public.customer_profile_versions set valid_to = v_effective_at
  where valid_to is null and customer_id in (select customer_id from public.customer_snapshot_memberships where customer_master_snapshot_id = v_master_snapshot.id);
  update public.customer_status_versions set valid_to = v_effective_at where valid_to is null;
  update public.customer_channel_assignments set valid_to = v_effective_at
  where valid_to is null and customer_id in (select customer_id from public.customer_snapshot_memberships where customer_master_snapshot_id = v_master_snapshot.id);
  update public.customer_segment_assignments set valid_to = v_effective_at
  where valid_to is null and customer_id in (select customer_id from public.customer_snapshot_memberships where customer_master_snapshot_id = v_master_snapshot.id);
  update public.customer_rep_assignments set valid_to = v_effective_at
  where valid_to is null and customer_id in (select customer_id from public.customer_snapshot_memberships where customer_master_snapshot_id = v_master_snapshot.id);
  update public.rep_ssm_assignments set valid_to = v_effective_at where valid_to is null;

  for v_customer in
    select c.customer_id, c.customer_code from public.customer_snapshot_memberships m join public.customers c on c.customer_id = m.customer_id
    where m.customer_master_snapshot_id = v_master_snapshot.id order by c.customer_code
  loop
    select array_agg(distinct public.customer_master_normalize_text(o.parsed_payload ->> 'customerName') order by public.customer_master_normalize_text(o.parsed_payload ->> 'customerName')) filter (where public.customer_master_normalize_text(o.parsed_payload ->> 'customerName') is not null),
      min(o.parsed_payload ->> 'customerName') filter (where public.customer_master_normalize_text(o.parsed_payload ->> 'customerName') is not null),
      array_agg(distinct public.customer_master_normalize_text(o.parsed_payload ->> 'storeName') order by public.customer_master_normalize_text(o.parsed_payload ->> 'storeName')) filter (where public.customer_master_normalize_text(o.parsed_payload ->> 'storeName') is not null),
      min(o.parsed_payload ->> 'storeName') filter (where public.customer_master_normalize_text(o.parsed_payload ->> 'storeName') is not null)
    into v_profile_names, v_profile_name, v_profile_stores, v_profile_store
    from public.customer_master_row_observations o where o.import_batch_id = p_batch_id and o.customer_code_candidate = v_customer.customer_code and o.customer_code_valid;
    v_resolution := case when coalesce(cardinality(v_profile_names), 0) > 1 or coalesce(cardinality(v_profile_stores), 0) > 1 then 'PARTIAL'::public.customer_resolution_state else 'RESOLVED'::public.customer_resolution_state end;
    insert into public.customer_profile_versions (customer_id, customer_master_snapshot_id, valid_from, resolution_state, profile_data, provenance)
    values (v_customer.customer_id, v_master_snapshot.id, v_effective_at, v_resolution,
      jsonb_strip_nulls(jsonb_build_object('customerName', v_profile_name, 'storeName', v_profile_store)),
      jsonb_build_object('nameCandidates', coalesce(to_jsonb(v_profile_names), '[]'::jsonb), 'storeCandidates', coalesce(to_jsonb(v_profile_stores), '[]'::jsonb)));
    if v_resolution = 'PARTIAL' then
      v_issue_count := v_issue_count + 1;
      insert into public.hierarchy_resolution_issues (customer_master_snapshot_id, customer_id, issue_code, details)
      values (v_master_snapshot.id, v_customer.customer_id, 'PROFILE_FIELD_CONFLICT', jsonb_build_object('customerCode', v_customer.customer_code));
    end if;
    insert into public.customer_status_versions (customer_id, customer_master_snapshot_id, valid_from, status, resolution_state, raw_status_distribution, provenance)
    values (v_customer.customer_id, v_master_snapshot.id, v_effective_at,
      public.customer_master_resolve_status(p_batch_id, v_customer.customer_code, v_effective_at), 'RESOLVED', '{}'::jsonb,
      jsonb_build_object('source', 'CUSTOMER_MASTER'));

    select array_agg(distinct coalesce((select d.channel from public.channel_aliases a join public.channel_definitions d on d.id = a.channel_id
      where a.raw_normalized = public.customer_master_normalize_text(o.parsed_payload ->> 'channel') and a.valid_from <= v_effective_at and (a.valid_to is null or a.valid_to > v_effective_at) order by a.valid_from desc limit 1), 'UNCLASSIFIED'::public.customer_channel))
    into v_channel_values from public.customer_master_row_observations o
    where o.import_batch_id = p_batch_id and o.customer_code_candidate = v_customer.customer_code and o.customer_code_valid;
    if 'OPEN'::public.customer_channel = any(v_channel_values) and 'CLOSED'::public.customer_channel = any(v_channel_values) then
      v_resolution := 'REVIEW_REQUIRED';
      v_issue_count := v_issue_count + 1;
      insert into public.hierarchy_resolution_issues (customer_master_snapshot_id, customer_id, issue_code, details) values
      (v_master_snapshot.id, v_customer.customer_id, 'CHANNEL_CONFLICT', jsonb_build_object('channels', to_jsonb(v_channel_values)));
      select id into v_channel_id from public.channel_definitions where channel = 'UNCLASSIFIED';
    else
      v_resolution := case when array_length(v_channel_values, 1) = 1 and v_channel_values[1] <> 'UNCLASSIFIED' then 'RESOLVED'::public.customer_resolution_state else 'UNRESOLVED'::public.customer_resolution_state end;
      select id into v_channel_id from public.channel_definitions where channel = coalesce(v_channel_values[1], 'UNCLASSIFIED'::public.customer_channel);
    end if;
    insert into public.customer_channel_assignments (customer_id, customer_master_snapshot_id, channel_id, valid_from, resolution_state, source_values, provenance)
    values (v_customer.customer_id, v_master_snapshot.id, v_channel_id, v_effective_at, v_resolution, coalesce(to_jsonb(v_channel_values), '[]'::jsonb), jsonb_build_object('source', 'CUSTOMER_MASTER'));

    select array_agg(distinct public.customer_master_normalize_text(o.parsed_payload ->> 'segment') order by public.customer_master_normalize_text(o.parsed_payload ->> 'segment')) filter (where public.customer_master_normalize_text(o.parsed_payload ->> 'segment') is not null)
    into v_segment_values from public.customer_master_row_observations o where o.import_batch_id = p_batch_id and o.customer_code_candidate = v_customer.customer_code and o.customer_code_valid;
    if coalesce(cardinality(v_segment_values), 0) = 1 then
      insert into public.segment_definitions (segment_code, display_name) values (v_segment_values[1], v_segment_values[1]) on conflict (segment_code) do nothing;
      select id into v_segment_id from public.segment_definitions where segment_code = v_segment_values[1];
      v_resolution := 'RESOLVED';
    else
      select id into v_segment_id from public.segment_definitions where segment_code = 'UNCLASSIFIED_SEGMENT';
      v_resolution := case when coalesce(cardinality(v_segment_values), 0) = 0 then 'UNRESOLVED'::public.customer_resolution_state else 'REVIEW_REQUIRED'::public.customer_resolution_state end;
      if coalesce(cardinality(v_segment_values), 0) > 1 then
        v_issue_count := v_issue_count + 1;
        insert into public.hierarchy_resolution_issues (customer_master_snapshot_id, customer_id, issue_code, details) values
        (v_master_snapshot.id, v_customer.customer_id, 'SEGMENT_CONFLICT', jsonb_build_object('segments', to_jsonb(v_segment_values)));
      end if;
    end if;
    insert into public.customer_segment_assignments (customer_id, customer_master_snapshot_id, segment_id, valid_from, resolution_state, source_values, provenance)
    values (v_customer.customer_id, v_master_snapshot.id, v_segment_id, v_effective_at, v_resolution, coalesce(to_jsonb(v_segment_values), '[]'::jsonb), jsonb_build_object('source', 'CUSTOMER_MASTER'));

    select array_agg(distinct public.customer_master_normalize_text(o.parsed_payload ->> 'salesRep') order by public.customer_master_normalize_text(o.parsed_payload ->> 'salesRep')) filter (where public.customer_master_normalize_text(o.parsed_payload ->> 'salesRep') is not null)
    into v_rep_values from public.customer_master_row_observations o where o.import_batch_id = p_batch_id and o.customer_code_candidate = v_customer.customer_code and o.customer_code_valid;
    if coalesce(cardinality(v_rep_values), 0) = 1 then
      insert into public.organization_people (person_kind, display_name, normalized_name)
      values ('SALES_REP', v_rep_values[1], v_rep_values[1]) on conflict (person_kind, normalized_name) do nothing;
      select id into v_rep_id from public.organization_people where person_kind = 'SALES_REP' and normalized_name = v_rep_values[1];
      insert into public.organization_person_aliases (person_id, person_kind, raw_name, raw_normalized, valid_from)
      values (v_rep_id, 'SALES_REP', v_rep_values[1], v_rep_values[1], v_effective_at)
      on conflict do nothing;
      v_resolution := 'RESOLVED';
    else
      v_rep_id := null;
      v_resolution := case when coalesce(cardinality(v_rep_values), 0) = 0 then 'UNASSIGNED'::public.customer_resolution_state else 'REVIEW_REQUIRED'::public.customer_resolution_state end;
      v_issue_count := v_issue_count + 1;
      insert into public.hierarchy_resolution_issues (customer_master_snapshot_id, customer_id, issue_code, details) values
      (v_master_snapshot.id, v_customer.customer_id, case when coalesce(cardinality(v_rep_values), 0) = 0 then 'CUSTOMER_UNASSIGNED_TO_REP' else 'CUSTOMER_REP_CONFLICT' end, jsonb_build_object('candidates', coalesce(to_jsonb(v_rep_values), '[]'::jsonb)));
    end if;
    insert into public.customer_rep_assignments (customer_id, customer_master_snapshot_id, rep_person_id, valid_from, resolution_state, source_candidates, provenance)
    values (v_customer.customer_id, v_master_snapshot.id, v_rep_id, v_effective_at, v_resolution, coalesce(to_jsonb(v_rep_values), '[]'::jsonb), jsonb_build_object('source', 'CUSTOMER_MASTER'));
  end loop;

  for v_rep in select distinct rep_person_id from public.customer_rep_assignments where customer_master_snapshot_id = v_master_snapshot.id and resolution_state = 'RESOLVED' loop
    select count(distinct cra.customer_id) into v_ssm_denominator
    from public.customer_rep_assignments cra
    join public.customer_status_versions st on st.customer_id = cra.customer_id and st.customer_master_snapshot_id = v_master_snapshot.id and st.status = 'ACTIVE'
    join public.customers c on c.customer_id = cra.customer_id
    join public.customer_master_row_observations o on o.import_batch_id = p_batch_id and o.customer_code_candidate = c.customer_code and o.customer_code_valid
    where cra.customer_master_snapshot_id = v_master_snapshot.id and cra.rep_person_id = v_rep.rep_person_id
      and public.customer_master_normalize_text(o.parsed_payload ->> 'distSalesChief') is not null;
    with candidates as (
      select public.customer_master_normalize_text(o.parsed_payload ->> 'distSalesChief') as ssm_norm, c.customer_id
      from public.customer_rep_assignments cra join public.customers c on c.customer_id = cra.customer_id
      join public.customer_master_row_observations o on o.import_batch_id = p_batch_id and o.customer_code_candidate = c.customer_code and o.customer_code_valid
      where cra.customer_master_snapshot_id = v_master_snapshot.id and cra.rep_person_id = v_rep.rep_person_id
        and public.customer_master_normalize_text(o.parsed_payload ->> 'distSalesChief') is not null
    ), counts as (select ssm_norm, count(distinct customer_id)::integer as n from candidates group by ssm_norm)
    select ssm_norm, n into v_ssm_norm, v_ssm_numerator from counts order by n desc, ssm_norm asc limit 1;
    with candidates as (
      select public.customer_master_normalize_text(o.parsed_payload ->> 'distSalesChief') as ssm_norm, c.customer_id
      from public.customer_rep_assignments cra join public.customers c on c.customer_id = cra.customer_id
      join public.customer_master_row_observations o on o.import_batch_id = p_batch_id and o.customer_code_candidate = c.customer_code and o.customer_code_valid
      where cra.customer_master_snapshot_id = v_master_snapshot.id and cra.rep_person_id = v_rep.rep_person_id
        and public.customer_master_normalize_text(o.parsed_payload ->> 'distSalesChief') is not null
    ), counts as (select ssm_norm, count(distinct customer_id)::integer as n from candidates group by ssm_norm)
    select count(*) into v_ssm_tie_count from counts where n = coalesce(v_ssm_numerator, -1);
    if v_ssm_denominator > 0 and v_ssm_numerator::numeric / v_ssm_denominator >= 0.90 and v_ssm_tie_count = 1 then
      v_ssm_name := v_ssm_norm;
      insert into public.organization_people (person_kind, display_name, normalized_name) values ('DIST_SALES_CHIEF', v_ssm_name, v_ssm_norm) on conflict (person_kind, normalized_name) do nothing;
      select id into v_ssm_id from public.organization_people where person_kind = 'DIST_SALES_CHIEF' and normalized_name = v_ssm_norm;
      insert into public.organization_person_aliases (person_id, person_kind, raw_name, raw_normalized, valid_from) values (v_ssm_id, 'DIST_SALES_CHIEF', v_ssm_name, v_ssm_norm, v_effective_at) on conflict do nothing;
      insert into public.rep_ssm_assignments (rep_person_id, customer_master_snapshot_id, ssm_person_id, valid_from, resolution_state, dominant_numerator, dominant_denominator, dominant_ratio, decision_reason)
      values (v_rep.rep_person_id, v_master_snapshot.id, v_ssm_id, v_effective_at, 'RESOLVED', v_ssm_numerator, v_ssm_denominator, v_ssm_numerator::numeric / v_ssm_denominator, 'DOMINANT_ACTIVE_CUSTOMER_DISTRIBUTION');
    else
      v_issue_count := v_issue_count + 1;
      insert into public.rep_ssm_assignments (rep_person_id, customer_master_snapshot_id, valid_from, resolution_state, dominant_numerator, dominant_denominator, dominant_ratio, decision_reason)
      values (v_rep.rep_person_id, v_master_snapshot.id, v_effective_at, 'REVIEW_REQUIRED', coalesce(v_ssm_numerator, 0), coalesce(v_ssm_denominator, 0), case when v_ssm_denominator > 0 then coalesce(v_ssm_numerator, 0)::numeric / v_ssm_denominator else null end, 'REP_SSM_DOMINANCE_BELOW_THRESHOLD_OR_TIE');
      insert into public.hierarchy_resolution_issues (customer_master_snapshot_id, rep_person_id, issue_code, details)
      values (v_master_snapshot.id, v_rep.rep_person_id, case when v_ssm_denominator = 0 then 'REP_WITHOUT_ACTIVE_CUSTOMER' else 'REP_SSM_DOMINANCE_BELOW_THRESHOLD' end,
        jsonb_build_object('numerator', coalesce(v_ssm_numerator, 0), 'denominator', coalesce(v_ssm_denominator, 0), 'tieCount', coalesce(v_ssm_tie_count, 0)));
    end if;
  end loop;

  if v_previous.id is not null then
    insert into public.customer_status_versions (customer_id, customer_master_snapshot_id, valid_from, status, resolution_state, raw_status_distribution, provenance)
    select m.customer_id, v_master_snapshot.id, v_effective_at, 'NOT_PRESENT_IN_CURRENT_MASTER', 'UNRESOLVED', '{}'::jsonb,
      jsonb_build_object('previousSnapshotId', v_previous.id, 'reason', 'NOT_PRESENT_IN_CURRENT_MASTER')
    from public.customer_snapshot_memberships m
    where m.customer_master_snapshot_id = v_previous.id
      and not exists (select 1 from public.customer_snapshot_memberships n where n.customer_master_snapshot_id = v_master_snapshot.id and n.customer_id = m.customer_id);
  end if;
  update public.master_resolution_runs set status = case when v_issue_count > 0 then 'SUCCEEDED_WITH_EXCEPTIONS' else 'SUCCEEDED' end,
    finished_at = now(), counts = jsonb_build_object('customerCount', (select count(*) from public.customer_snapshot_memberships where customer_master_snapshot_id = v_master_snapshot.id), 'issueCount', v_issue_count),
    coverage = jsonb_build_object('validRowCount', v_batch.valid_row_count, 'invalidRowCount', v_batch.invalid_row_count)
  where customer_master_snapshot_id = v_master_snapshot.id;
  if v_issue_count > 0 then update public.customer_master_snapshots set status = 'PUBLISHED_WITH_EXCEPTIONS' where id = v_master_snapshot.id; end if;
  perform public.transition_import_batch(p_batch_id, 'PUBLISHED'::public.import_batch_status, 'CUSTOMER_MASTER_PUBLICATION_COMPLETED', gen_random_uuid(), p_correlation_id,
    jsonb_build_object('customerMasterSnapshotId', v_master_snapshot.id, 'snapshotVersion', v_snapshot_version));
  v_response := jsonb_build_object('batchId', p_batch_id, 'status', 'PUBLISHED', 'customerMasterSnapshotId', v_master_snapshot.id, 'snapshotVersion', v_snapshot_version, 'issueCount', v_issue_count);
  insert into public.import_request_idempotency (actor_id, endpoint, idempotency_key, request_fingerprint, import_batch_id, publication_snapshot_id, response_payload)
  values (auth.uid(), 'customer-master.publish', p_idempotency_key, p_request_fingerprint, p_batch_id, v_generic_snapshot.id, v_response);
  return v_response;
end;
$$;

create or replace function public.customer_master_read_context_v2(p_as_of timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_snapshot as (
    select s.id, s.import_batch_id, s.business_effective_at, s.status, p.snapshot_version
    from public.customer_master_snapshots s
    join public.publication_snapshots p on p.id = s.publication_snapshot_id
    where s.business_effective_at <= p_as_of
      and s.status in ('PUBLISHED', 'PUBLISHED_WITH_EXCEPTIONS')
    order by s.business_effective_at desc, p.snapshot_version desc
    limit 1
  ), selected_run as (
    select r.* from public.master_resolution_runs r
    join selected_snapshot s on s.id = r.customer_master_snapshot_id
  ), snapshot_issues as (
    select h.issue_code, count(*)::integer as issue_count
    from public.hierarchy_resolution_issues h
    join selected_snapshot s on s.id = h.customer_master_snapshot_id
    where h.state = 'OPEN'
    group by h.issue_code
  ), not_present as (
    select count(*)::integer as customer_count
    from public.customer_status_versions v
    where v.status = 'NOT_PRESENT_IN_CURRENT_MASTER'
      and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of)
  )
  select jsonb_build_object(
    'asOf', p_as_of,
    'sourceSnapshot', coalesce((select jsonb_build_object(
      'id', id, 'importBatchId', import_batch_id, 'snapshotVersion', snapshot_version,
      'businessEffectiveAt', business_effective_at, 'status', status
    ) from selected_snapshot), 'null'::jsonb),
    'resolutionRun', coalesce((select jsonb_build_object(
      'id', id, 'ruleVersion', rule_version, 'status', status, 'counts', counts, 'coverage', coverage
    ) from selected_run), 'null'::jsonb),
    'coverage', case when exists (select 1 from selected_snapshot)
      then coalesce((select coverage from selected_run), '{}'::jsonb) || jsonb_build_object('source', 'CUSTOMER_MASTER', 'status', 'AVAILABLE')
      else jsonb_build_object('source', 'CUSTOMER_MASTER', 'status', 'NO_ACTIVE_SNAPSHOT') end,
    'exclusions', jsonb_build_object('notPresentInCurrentMasterCustomerCount', (select customer_count from not_present)),
    'issueSummary', jsonb_build_object(
      'openIssueCount', coalesce((select sum(issue_count) from snapshot_issues), 0),
      'byCode', coalesce((select jsonb_object_agg(issue_code, issue_count) from snapshot_issues), '{}'::jsonb)
    )
  );
$$;

create or replace function public.customer_master_list_v2(
  p_as_of timestamptz default now(), p_status text default null, p_channel text default null, p_segment text default null,
  p_rep_id uuid default null, p_ssm_id uuid default null, p_resolution_state text default null, p_page integer default 1, p_page_size integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_items jsonb;
declare v_context jsonb;
begin
  perform public.require_customer_master_capability('customer.view');
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception 'INVALID_PAGINATION' using errcode = '22023'; end if;
  select public.customer_master_read_context_v2(p_as_of) into v_context;
  select coalesce(jsonb_agg(jsonb_build_object(
    'customerCode', customer_code, 'status', status, 'channel', channel, 'segment', segment_code,
    'repId', rep_person_id, 'ssmId', ssm_person_id, 'resolutionState', status_resolution_state
  ) order by customer_code), '[]'::jsonb) into v_items
  from (
    select
      c.customer_code, st.status, st.resolution_state as status_resolution_state, cd.channel,
      sd.segment_code, cra.rep_person_id, rsa.ssm_person_id
    from public.customers c
    left join lateral (select * from public.customer_status_versions v where v.customer_id = c.customer_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) st on true
    left join lateral (select * from public.customer_channel_assignments v where v.customer_id = c.customer_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) ca on true
    left join public.channel_definitions cd on cd.id = ca.channel_id
    left join lateral (select * from public.customer_segment_assignments v where v.customer_id = c.customer_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) sa on true
    left join public.segment_definitions sd on sd.id = sa.segment_id
    left join lateral (select * from public.customer_rep_assignments v where v.customer_id = c.customer_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) cra on true
    left join lateral (select * from public.rep_ssm_assignments v where v.rep_person_id = cra.rep_person_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) rsa on true
    where st.id is not null
      and (p_status is null or st.status::text = p_status)
      and (p_channel is null or cd.channel::text = p_channel)
      and (p_segment is null or sd.segment_code = p_segment)
      and (p_rep_id is null or cra.rep_person_id = p_rep_id)
      and (p_ssm_id is null or rsa.ssm_person_id = p_ssm_id)
      and (p_resolution_state is null or st.resolution_state::text = p_resolution_state)
    order by c.customer_code offset (p_page - 1) * p_page_size limit p_page_size
  ) q;
  return v_context || jsonb_build_object('page', p_page, 'pageSize', p_page_size, 'items', v_items);
end;
$$;

create or replace function public.customer_master_customer_v2(p_customer_code text, p_as_of timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_item jsonb;
declare v_context jsonb;
begin
  perform public.require_customer_master_capability('customer.view');
  select public.customer_master_read_context_v2(p_as_of) into v_context;
  select jsonb_build_object('customerCode', c.customer_code, 'status', st.status, 'channel', cd.channel, 'segment', sd.segment_code,
    'repId', cra.rep_person_id, 'ssmId', rsa.ssm_person_id, 'asOf', p_as_of) into v_item
  from public.customers c
  left join lateral (select * from public.customer_status_versions v where v.customer_id = c.customer_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) st on true
  left join lateral (select * from public.customer_channel_assignments v where v.customer_id = c.customer_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) ca on true
  left join public.channel_definitions cd on cd.id = ca.channel_id
  left join lateral (select * from public.customer_segment_assignments v where v.customer_id = c.customer_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) sa on true
  left join public.segment_definitions sd on sd.id = sa.segment_id
  left join lateral (select * from public.customer_rep_assignments v where v.customer_id = c.customer_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) cra on true
  left join lateral (select * from public.rep_ssm_assignments v where v.rep_person_id = cra.rep_person_id and v.valid_from <= p_as_of and (v.valid_to is null or v.valid_to > p_as_of) order by v.valid_from desc limit 1) rsa on true
  where c.customer_code = p_customer_code and st.id is not null;
  if v_item is null then raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002'; end if;
  return v_context || v_item;
end;
$$;

create or replace function public.customer_master_history_v2(p_customer_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_customer_id uuid;
begin
  perform public.require_customer_master_capability('customer.audit');
  perform public.require_customer_master_capability('import.audit');
  select customer_id into v_customer_id from public.customers where customer_code = p_customer_code;
  if v_customer_id is null then raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002'; end if;
  return jsonb_build_object('customerCode', p_customer_code,
    'statusHistory', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'validFrom', valid_from, 'validTo', valid_to, 'provenance', provenance) order by valid_from) from public.customer_status_versions where customer_id = v_customer_id), '[]'::jsonb),
    'profileHistory', coalesce((select jsonb_agg(jsonb_build_object('validFrom', valid_from, 'validTo', valid_to, 'resolutionState', resolution_state, 'profile', profile_data, 'provenance', provenance) order by valid_from) from public.customer_profile_versions where customer_id = v_customer_id), '[]'::jsonb));
end;
$$;

create or replace function public.customer_master_organization_v2(
  p_kind text,
  p_as_of timestamptz default now(),
  p_scope text default 'SALES',
  p_issue_code text default null,
  p_issue_state text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_context jsonb;
declare v_items jsonb;
begin
  perform public.require_customer_master_capability('organization.view');
  if p_kind not in ('REPS', 'SSMS', 'HIERARCHY', 'EXCEPTIONS') then raise exception 'INVALID_ORGANIZATION_QUERY' using errcode = '22023'; end if;
  if p_scope not in ('SALES', 'FINANCIAL', 'ALL') then raise exception 'INVALID_ORGANIZATION_SCOPE' using errcode = '22023'; end if;
  if p_issue_state is not null and p_issue_state not in ('OPEN', 'RESOLVED', 'WAIVED') then raise exception 'INVALID_ISSUE_STATE' using errcode = '22023'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception 'INVALID_PAGINATION' using errcode = '22023'; end if;
  select public.customer_master_read_context_v2(p_as_of) into v_context;
  if p_scope = 'FINANCIAL' then
    return jsonb_set(v_context, '{coverage}', (v_context -> 'coverage') || jsonb_build_object('financial', 'UNAVAILABLE_DEPENDENCY', 'status', 'UNAVAILABLE_DEPENDENCY'))
      || jsonb_build_object('scope', p_scope, 'page', p_page, 'pageSize', p_page_size, 'items', '[]'::jsonb);
  end if;
  if p_scope = 'ALL' then
    v_context := jsonb_set(v_context, '{coverage}', (v_context -> 'coverage') || jsonb_build_object('financial', 'UNAVAILABLE_DEPENDENCY', 'status', 'PARTIAL'));
  end if;
  if p_kind = 'EXCEPTIONS' then
    select coalesce(jsonb_agg(jsonb_build_object('code', issue_code, 'state', state, 'details', details, 'customerId', customer_id, 'repId', rep_person_id) order by created_at, id), '[]'::jsonb)
      into v_items
    from (
      select h.* from public.hierarchy_resolution_issues h
      join public.customer_master_snapshots s on s.id = h.customer_master_snapshot_id
      where s.business_effective_at <= p_as_of
        and (p_issue_code is null or h.issue_code = p_issue_code)
        and (p_issue_state is null or h.state = p_issue_state)
      order by h.created_at, h.id offset (p_page - 1) * p_page_size limit p_page_size
    ) q;
    return v_context || jsonb_build_object('scope', p_scope, 'page', p_page, 'pageSize', p_page_size, 'items', v_items);
  end if;
  if p_kind = 'REPS' then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'displayName', display_name) order by display_name, id), '[]'::jsonb)
      into v_items
    from (
      select p.id, p.display_name from public.organization_people p
      where p.person_kind = 'SALES_REP' and p.is_active
        and exists (select 1 from public.customer_rep_assignments r where r.rep_person_id = p.id and r.valid_from <= p_as_of and (r.valid_to is null or r.valid_to > p_as_of))
      order by p.display_name, p.id offset (p_page - 1) * p_page_size limit p_page_size
    ) q;
    return v_context || jsonb_build_object('scope', p_scope, 'page', p_page, 'pageSize', p_page_size, 'items', v_items);
  end if;
  if p_kind = 'SSMS' then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'displayName', display_name) order by display_name, id), '[]'::jsonb)
      into v_items
    from (
      select p.id, p.display_name from public.organization_people p
      where p.person_kind = 'DIST_SALES_CHIEF' and p.is_active
        and exists (select 1 from public.rep_ssm_assignments r where r.ssm_person_id = p.id and r.valid_from <= p_as_of and (r.valid_to is null or r.valid_to > p_as_of))
      order by p.display_name, p.id offset (p_page - 1) * p_page_size limit p_page_size
    ) q;
    return v_context || jsonb_build_object('scope', p_scope, 'page', p_page, 'pageSize', p_page_size, 'items', v_items);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('repId', rep_person_id, 'ssmId', ssm_person_id, 'resolutionState', resolution_state, 'dominantRatio', dominant_ratio) order by rep_person_id, id), '[]'::jsonb)
    into v_items
  from (
    select r.* from public.rep_ssm_assignments r
    where r.valid_from <= p_as_of and (r.valid_to is null or r.valid_to > p_as_of)
    order by r.rep_person_id, r.id offset (p_page - 1) * p_page_size limit p_page_size
  ) q;
  return v_context || jsonb_build_object('scope', p_scope, 'page', p_page, 'pageSize', p_page_size, 'items', v_items);
end;
$$;

create or replace function public.customer_master_reconciliation_v2(p_snapshot_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_snapshot public.customer_master_snapshots;
begin
  perform public.require_customer_master_capability('customer.audit');
  select * into v_snapshot from public.customer_master_snapshots where id = p_snapshot_id;
  if not found then raise exception 'CUSTOMER_MASTER_SNAPSHOT_NOT_FOUND' using errcode = 'P0002'; end if;
  return jsonb_build_object('snapshotId', v_snapshot.id, 'importBatchId', v_snapshot.import_batch_id,
    'controlTotals', v_snapshot.control_totals, 'customerCount', (select count(*) from public.customer_snapshot_memberships where customer_master_snapshot_id = v_snapshot.id),
    'issueCount', (select count(*) from public.hierarchy_resolution_issues where customer_master_snapshot_id = v_snapshot.id),
    'status', v_snapshot.status);
end;
$$;

revoke all on function public.customer_master_normalize_text(text) from public, anon;
revoke all on function public.require_customer_master_capability(text) from public, anon;
revoke all on function public.customer_master_resolve_status(uuid, text, timestamptz) from public, anon;
revoke all on function public.customer_master_read_context_v2(timestamptz) from public, anon;
revoke all on function public.parse_customer_master_batch(uuid, jsonb, text, text) from public, anon;
revoke all on function public.validate_customer_master_batch(uuid, text) from public, anon;
revoke all on function public.publish_customer_master_batch(uuid, uuid, integer, text, text, timestamptz, text) from public, anon;
revoke all on function public.customer_master_list_v2(timestamptz, text, text, text, uuid, uuid, text, integer, integer) from public, anon;
revoke all on function public.customer_master_customer_v2(text, timestamptz) from public, anon;
revoke all on function public.customer_master_history_v2(text) from public, anon;
revoke all on function public.customer_master_organization_v2(text, timestamptz, text, text, text, integer, integer) from public, anon;
revoke all on function public.customer_master_reconciliation_v2(uuid) from public, anon;
grant execute on function public.parse_customer_master_batch(uuid, jsonb, text, text), public.validate_customer_master_batch(uuid, text), public.publish_customer_master_batch(uuid, uuid, integer, text, text, timestamptz, text) to authenticated;
grant execute on function public.customer_master_list_v2(timestamptz, text, text, text, uuid, uuid, text, integer, integer), public.customer_master_customer_v2(text, timestamptz), public.customer_master_history_v2(text), public.customer_master_organization_v2(text, timestamptz, text, text, text, integer, integer), public.customer_master_reconciliation_v2(uuid) to authenticated;

-- Package 03: immutable package-conversion ingestion.  A conversion is evidence
-- only; it is never a warehouse movement and never creates a sales result.

create or replace function public.require_product_capability(p_capability text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_capability(auth.uid(), p_capability) then
    raise exception 'PRODUCT_CAPABILITY_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.parse_package_conversion_batch(
  p_batch_id uuid, p_rows jsonb, p_parser_version text, p_correlation_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_row jsonb; v_raw uuid; v_record uuid; v_count integer := 0;
begin
  perform public.require_import_capability('import.create');
  if jsonb_typeof(p_rows) <> 'array' or btrim(coalesce(p_parser_version, '')) = '' then
    raise exception 'INVALID_PACKAGE_CONVERSION_PARSE_REQUEST' using errcode = '22023';
  end if;
  select * into v_batch from public.import_batches where id = p_batch_id and created_by = auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'PACKAGE_CONVERSION_HISTORY' or v_batch.status <> 'HASH_VERIFIED' then
    raise exception 'PACKAGE_CONVERSION_PARSE_NOT_ALLOWED' using errcode = '55000';
  end if;
  perform public.transition_import_batch(p_batch_id, 'PARSING', 'PACKAGE_CONVERSION_PARSE_STARTED', gen_random_uuid(), p_correlation_id);
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if coalesce(v_row ->> 'sheetName', '') = ''
      or coalesce(v_row ->> 'sourceRowNumber', '') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(v_row -> 'rawCells') <> 'object'
      or coalesce(v_row ->> 'rowHash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(v_row ->> 'naturalKeyHash', '') !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(v_row -> 'parsedPayload') <> 'object' then
      raise exception 'INVALID_PACKAGE_CONVERSION_ROW' using errcode = '22023';
    end if;
    insert into public.raw_source_rows(import_batch_id, sheet_name, source_row_number, raw_cells, row_hash)
    values (p_batch_id, v_row ->> 'sheetName', (v_row ->> 'sourceRowNumber')::integer, v_row -> 'rawCells', v_row ->> 'rowHash') returning id into v_raw;
    insert into public.source_record_versions(source_kind, source_record_key, version_no, record_fingerprint, staging_payload, import_batch_id, created_by)
    values ('PACKAGE_CONVERSION_HISTORY', p_batch_id::text || ':' || (v_row ->> 'sheetName') || ':' || (v_row ->> 'sourceRowNumber'), 1,
      v_row ->> 'rowHash', v_row -> 'parsedPayload', p_batch_id, auth.uid()) returning id into v_record;
    insert into public.source_record_version_raw_rows(source_record_version_id, raw_source_row_id) values (v_record, v_raw);
    insert into public.package_conversion_observations(
      import_batch_id, source_record_version_id, raw_source_row_id, sheet_name, source_row_number,
      operation_date, source_material_code, source_quantity, target_material_code, target_quantity,
      source_document_reference, parser_warnings, natural_key_hash
    ) values (
      p_batch_id, v_record, v_raw, v_row ->> 'sheetName', (v_row ->> 'sourceRowNumber')::integer,
      nullif(v_row -> 'parsedPayload' ->> 'operationDate', '')::date,
      nullif(v_row -> 'parsedPayload' ->> 'sourceMaterialCode', ''),
      nullif(v_row -> 'parsedPayload' ->> 'sourceQuantity', '')::numeric,
      nullif(v_row -> 'parsedPayload' ->> 'targetMaterialCode', ''),
      nullif(v_row -> 'parsedPayload' ->> 'targetQuantity', '')::numeric,
      nullif(v_row -> 'parsedPayload' ->> 'sourceDocumentReference', ''),
      coalesce(v_row -> 'parserWarnings', '[]'::jsonb), v_row ->> 'naturalKeyHash'
    );
    v_count := v_count + 1;
  end loop;
  update public.import_batches set read_row_count = v_count, valid_row_count = 0, invalid_row_count = 0 where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED', 'PACKAGE_CONVERSION_PARSE_COMPLETED', gen_random_uuid(), p_correlation_id,
    jsonb_build_object('parserVersion', p_parser_version, 'readRowCount', v_count));
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PARSED', 'readRowCount', v_count);
end;
$$;

create or replace function public.validate_package_conversion_batch(
  p_batch_id uuid, p_correlation_id text default null, p_graph_issues jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_valid integer; v_invalid integer; v_conflicts integer; v_graph_issue jsonb;
begin
  perform public.require_import_capability('import.validate');
  select * into v_batch from public.import_batches where id = p_batch_id and created_by = auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'PACKAGE_CONVERSION_HISTORY' or v_batch.status <> 'PARSED' then raise exception 'PACKAGE_CONVERSION_VALIDATION_NOT_ALLOWED' using errcode = '55000'; end if;
  perform public.transition_import_batch(p_batch_id, 'VALIDATING', 'PACKAGE_CONVERSION_VALIDATION_STARTED', gen_random_uuid(), p_correlation_id);
  insert into public.validation_runs(import_batch_id, status, source_contract_version_id, created_by)
  values (p_batch_id, 'RUNNING', v_batch.source_contract_version_id, auth.uid()) returning * into v_run;
  insert into public.data_quality_issues(validation_run_id, severity, blocks_publication, message_key, details)
  select v_run.id, 'BLOCKING', true,
    case when o.source_material_code is null or o.target_material_code is null then 'INVALID_MATERIAL_CODE'
      when o.operation_date is null then 'INVALID_CONVERSION_DATE'
      when o.source_quantity is null or o.target_quantity is null then 'INVALID_CONVERSION_QUANTITY'
      when o.source_material_code = o.target_material_code then 'SELF_CONVERSION_EDGE'
      else null end,
    jsonb_build_object('sourceRowNumber', o.source_row_number)
  from public.package_conversion_observations o
  where o.import_batch_id = p_batch_id and (
    o.source_material_code is null or o.target_material_code is null or o.operation_date is null
    or o.source_quantity is null or o.target_quantity is null or o.source_material_code = o.target_material_code
  );
  insert into public.data_quality_issues(validation_run_id, severity, blocks_publication, message_key, details)
  select v_run.id, 'BLOCKING', true, 'CONVERSION_RATIO_CONFLICT',
    jsonb_build_object('sourceMaterialCode', source_material_code, 'targetMaterialCode', target_material_code, 'operationDate', operation_date)
  from public.package_conversion_observations
  where import_batch_id = p_batch_id and source_material_code is not null and target_material_code is not null
  group by source_material_code, target_material_code, operation_date
  having count(distinct target_quantity / source_quantity) > 1;
  if jsonb_typeof(coalesce(p_graph_issues, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_PRODUCT_GRAPH_ISSUES' using errcode = '22023';
  end if;
  for v_graph_issue in select value from jsonb_array_elements(coalesce(p_graph_issues, '[]'::jsonb))
  loop
    if v_graph_issue->>'code' in ('CONVERSION_RATIO_CONFLICT','MULTI_PATH_RATIO_CONFLICT','CONVERSION_CYCLE_INCONSISTENT') then
      insert into public.data_quality_issues(validation_run_id, severity, blocks_publication, message_key, details)
      values (v_run.id, 'BLOCKING', true, v_graph_issue->>'code', v_graph_issue - 'code');
    end if;
  end loop;
  select count(*) filter (where source_material_code is not null and target_material_code is not null and operation_date is not null
      and source_quantity is not null and target_quantity is not null and source_material_code <> target_material_code),
    count(*) filter (where source_material_code is null or target_material_code is null or operation_date is null
      or source_quantity is null or target_quantity is null or source_material_code = target_material_code)
  into v_valid, v_invalid from public.package_conversion_observations where import_batch_id = p_batch_id;
  select count(*) into v_conflicts from public.data_quality_issues where validation_run_id = v_run.id and blocks_publication;
  perform set_config('app.import_validation_transition', 'on', true);
  update public.validation_runs set status = case when v_conflicts > 0 then 'FAILED' else 'SUCCEEDED' end, finished_at = now(),
    control_totals = jsonb_build_object('readRowCount', v_batch.read_row_count, 'validRowCount', v_valid, 'invalidRowCount', v_invalid, 'blockingIssueCount', v_conflicts)
  where id = v_run.id;
  update public.import_batches set active_validation_run_id = v_run.id, valid_row_count = v_valid, invalid_row_count = v_invalid where id = p_batch_id;
  if v_conflicts > 0 then
    perform public.transition_import_batch(p_batch_id, 'FAILED', 'PACKAGE_CONVERSION_VALIDATION_FAILED', gen_random_uuid(), p_correlation_id);
    raise exception 'PACKAGE_CONVERSION_VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform public.transition_import_batch(p_batch_id, 'VALIDATED', 'PACKAGE_CONVERSION_VALIDATION_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'VALIDATED', 'validationRunId', v_run.id, 'validRowCount', v_valid, 'invalidRowCount', v_invalid);
end;
$$;

create or replace function public.publish_package_conversion_batch(
  p_batch_id uuid, p_expected_validation_run_id uuid, p_expected_snapshot_version integer,
  p_idempotency_key text, p_request_fingerprint text, p_correlation_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_snapshot public.publication_snapshots; v_previous public.publication_snapshots;
  v_resolution uuid; v_edge record; v_source uuid; v_target uuid; v_source_family uuid; v_target_family uuid; v_family uuid; v_issues integer := 0; v_anchor_issues integer := 0; v_response jsonb;
begin
  perform public.require_import_capability('import.publish'); perform public.require_product_capability('product.publish');
  perform pg_advisory_xact_lock(hashtextextended('PACKAGE_CONVERSION_HISTORY:' || p_batch_id::text, 0));
  select * into v_batch from public.import_batches where id = p_batch_id and created_by = auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'PACKAGE_CONVERSION_HISTORY' or v_batch.status <> 'VALIDATED' or v_batch.active_validation_run_id <> p_expected_validation_run_id then
    raise exception 'PACKAGE_CONVERSION_PUBLICATION_NOT_ALLOWED' using errcode = '55000'; end if;
  select * into v_run from public.validation_runs where id = p_expected_validation_run_id and status = 'SUCCEEDED';
  if not found then raise exception 'VALIDATION_RUN_NOT_PUBLISHABLE' using errcode = '55000'; end if;
  select * into v_previous from public.publication_snapshots where source_kind = 'PACKAGE_CONVERSION_HISTORY' and scope_key = v_batch.scope_key and is_active for update;
  if coalesce(v_previous.snapshot_version, 0) <> p_expected_snapshot_version then raise exception 'SNAPSHOT_VERSION_CONFLICT' using errcode = '40001'; end if;
  perform public.transition_import_batch(p_batch_id, 'PUBLISHING', 'PACKAGE_CONVERSION_PUBLICATION_STARTED', gen_random_uuid(), p_correlation_id);
  perform set_config('app.import_publish', 'on', true);
  insert into public.publication_snapshots(source_kind, scope_key, import_batch_id, validation_run_id, snapshot_version, is_active, published_by, previous_snapshot_id, control_totals)
  values ('PACKAGE_CONVERSION_HISTORY', v_batch.scope_key, p_batch_id, p_expected_validation_run_id, p_expected_snapshot_version + 1, true, auth.uid(), v_previous.id,
    (select control_totals from public.validation_runs where id = p_expected_validation_run_id)) returning * into v_snapshot;
  if found then update public.publication_snapshots set is_active = false where id = v_previous.id; end if;
  insert into public.publication_snapshot_items(publication_snapshot_id, source_record_version_id)
  select v_snapshot.id, source_record_version_id from public.package_conversion_observations where import_batch_id = p_batch_id;
  insert into public.product_variants(material_code, created_from_import_batch_id)
  select distinct code, p_batch_id from (
    select source_material_code as code from public.package_conversion_observations where import_batch_id=p_batch_id
    union select target_material_code from public.package_conversion_observations where import_batch_id=p_batch_id
  ) codes on conflict (material_code) do nothing;
  insert into public.product_resolution_runs(import_batch_id, rule_version, status, input_versions, component_summary, coverage, result_hash, finished_at, created_by)
  values (p_batch_id, 'product-resolution-v2/1.0.0', 'RUNNING', jsonb_build_object('publicationSnapshotId', v_snapshot.id), '{}', '{}',
    encode(extensions.digest(p_batch_id::text || ':' || p_expected_validation_run_id::text, 'sha256'), 'hex'), now(), auth.uid()) returning id into v_resolution;
  for v_edge in
    select source_material_code, target_material_code, min(operation_date) as valid_from,
      target_quantity / source_quantity as ratio, count(*)::integer as evidence_count,
      jsonb_agg(id order by id) as observation_ids
    from public.package_conversion_observations where import_batch_id = p_batch_id
    group by source_material_code, target_material_code, target_quantity / source_quantity
  loop
    select product_variant_id into v_source from public.product_variants where material_code=v_edge.source_material_code;
    select product_variant_id into v_target from public.product_variants where material_code=v_edge.target_material_code;
    insert into public.package_conversion_edge_versions(source_product_variant_id, target_product_variant_id, target_units_per_source_unit, valid_from, evidence_count, resolution_state, rule_version, provenance)
    values (v_source, v_target, v_edge.ratio, v_edge.valid_from::timestamptz, v_edge.evidence_count, 'RESOLVED', 'product-resolution-v2/1.0.0', jsonb_build_object('observationIds', v_edge.observation_ids));
    select product_family_id into v_source_family from public.product_family_membership_versions where product_variant_id=v_source and valid_to is null order by valid_from desc limit 1;
    select product_family_id into v_target_family from public.product_family_membership_versions where product_variant_id=v_target and valid_to is null order by valid_from desc limit 1;
    if v_source_family is null and v_target_family is null then
      insert into public.product_families(display_name, creation_reason) values ('Ürün ailesi ' || v_edge.source_material_code, 'CONSISTENT_PACKAGE_GRAPH') returning product_family_id into v_family;
      insert into public.product_family_membership_versions(product_variant_id, product_family_id, valid_from, resolution_state, evidence, decision_source)
      values (v_source, v_family, v_edge.valid_from::timestamptz, 'RESOLVED', jsonb_build_array(v_edge.observation_ids), 'PACKAGE_PROPAGATED'),
        (v_target, v_family, v_edge.valid_from::timestamptz, 'RESOLVED', jsonb_build_array(v_edge.observation_ids), 'PACKAGE_PROPAGATED');
    elsif v_source_family is null then
      insert into public.product_family_membership_versions(product_variant_id, product_family_id, valid_from, resolution_state, evidence, decision_source)
      values (v_source, v_target_family, v_edge.valid_from::timestamptz, 'RESOLVED', jsonb_build_array(v_edge.observation_ids), 'PACKAGE_PROPAGATED');
    elsif v_target_family is null then
      insert into public.product_family_membership_versions(product_variant_id, product_family_id, valid_from, resolution_state, evidence, decision_source)
      values (v_target, v_source_family, v_edge.valid_from::timestamptz, 'RESOLVED', jsonb_build_array(v_edge.observation_ids), 'PACKAGE_PROPAGATED');
    elsif v_source_family <> v_target_family then
      insert into public.product_resolution_issues(product_resolution_run_id, product_variant_id, issue_code, details)
      values (v_resolution, v_source, 'FAMILY_MERGE_REVIEW', jsonb_build_object('sourceFamilyId',v_source_family,'targetFamilyId',v_target_family,'targetVariantId',v_target));
      v_issues := v_issues + 1;
    end if;
  end loop;
  insert into public.product_resolution_issues(product_resolution_run_id, product_variant_id, issue_code, details)
  select v_resolution, product_variant_id, 'MISSING_LITRE_ANCHOR', jsonb_build_object('reason','PACKAGE_GRAPH_HAS_NO_ABSOLUTE_LITRE_ANCHOR')
  from public.product_variants v where exists (select 1 from public.package_conversion_edge_versions e where e.source_product_variant_id=v.product_variant_id or e.target_product_variant_id=v.product_variant_id)
    and not exists (select 1 from public.product_litre_versions l where l.product_variant_id=v.product_variant_id and l.valid_to is null);
  get diagnostics v_anchor_issues = row_count;
  v_issues := v_issues + v_anchor_issues;
  update public.product_resolution_runs set status=(case when v_issues>0 then 'SUCCEEDED_WITH_EXCEPTIONS' else 'SUCCEEDED' end)::public.product_resolution_run_status,
    component_summary=jsonb_build_object('edgeCount',(select count(*) from public.package_conversion_edge_versions where created_at >= transaction_timestamp()), 'issueCount',v_issues),
    coverage=jsonb_build_object('status',case when v_issues>0 then 'PARTIAL_COVERAGE' else 'COMPLETE' end,'litreAnchorCount',(select count(*) from public.product_litre_versions where valid_to is null))
  where id=v_resolution;
  perform public.transition_import_batch(p_batch_id, 'PUBLISHED', 'PACKAGE_CONVERSION_PUBLICATION_COMPLETED', gen_random_uuid(), p_correlation_id, jsonb_build_object('publicationSnapshotId',v_snapshot.id,'resolutionRunId',v_resolution));
  v_response:=jsonb_build_object('batchId',p_batch_id,'status','PUBLISHED','publicationSnapshotId',v_snapshot.id,'snapshotVersion',v_snapshot.snapshot_version,'resolutionRunId',v_resolution,'issueCount',v_issues);
  insert into public.import_request_idempotency(actor_id,endpoint,idempotency_key,request_fingerprint,import_batch_id,publication_snapshot_id,response_payload)
  values(auth.uid(),'package-conversions.publish',p_idempotency_key,p_request_fingerprint,p_batch_id,v_snapshot.id,v_response);
  return v_response;
end;
$$;

-- Package 03A: parse/validate/publish is purpose-built.  Old item payload is never a business history API.

create or replace function public.require_current_stock_capability(p_capability text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_capability(auth.uid(), p_capability) then raise exception 'CURRENT_STOCK_CAPABILITY_REQUIRED' using errcode='42501'; end if;
end; $$;

create or replace function public.current_stock_canonical_decimal(p_value numeric) returns text language sql immutable as $$ select trim(trailing '.' from trim(trailing '0' from p_value::text)) $$;

create or replace function public.parse_current_stock_batch(p_batch_id uuid, p_rows jsonb, p_parser_version text, p_correlation_id text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_row jsonb; v_count integer:=0;
begin
  perform public.require_current_stock_capability('stock.current.upload');
  select * into v_batch from public.import_batches where id=p_batch_id and created_by=auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode='P0002'; end if;
  if v_batch.source_kind <> 'CURRENT_STOCK_AVAILABLE' or coalesce(v_batch.scope_payload->>'warehouseCode','') <> 'DEFAULT_WAREHOUSE' or v_batch.status <> 'HASH_VERIFIED' then raise exception 'CURRENT_STOCK_PARSE_NOT_ALLOWED' using errcode='55000'; end if;
  if jsonb_typeof(p_rows) <> 'array' or btrim(coalesce(p_parser_version,''))='' then raise exception 'INVALID_CURRENT_STOCK_PARSE_REQUEST' using errcode='22023'; end if;
  perform public.transition_import_batch(p_batch_id,'PARSING','CURRENT_STOCK_PARSE_STARTED',gen_random_uuid(),p_correlation_id);
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if coalesce(v_row->>'materialCode','')='' or coalesce(v_row->>'materialName','')='' or coalesce(v_row->>'availableQuantity','') !~ '^[0-9]+(\.[0-9]+)?$' or coalesce(v_row->>'rowHash','') !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_CURRENT_STOCK_ROW' using errcode='22023'; end if;
    insert into public.current_stock_staging_items(import_batch_id,material_code,material_name,available_quantity,source_ref,row_hash,parser_warnings)
    values(p_batch_id,v_row->>'materialCode',v_row->>'materialName',(v_row->>'availableQuantity')::numeric,coalesce(v_row->'sourceRef','{}'::jsonb),v_row->>'rowHash',coalesce(v_row->'warnings','[]'::jsonb)); v_count:=v_count+1;
  end loop;
  update public.import_batches set read_row_count=v_count,valid_row_count=0,invalid_row_count=0 where id=p_batch_id;
  perform public.transition_import_batch(p_batch_id,'PARSED','CURRENT_STOCK_PARSE_COMPLETED',gen_random_uuid(),p_correlation_id,jsonb_build_object('parserVersion',p_parser_version));
  return jsonb_build_object('batchId',p_batch_id,'status','PARSED','readRowCount',v_count);
end; $$;

create or replace function public.validate_current_stock_batch(p_batch_id uuid, p_correlation_id text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_blocking integer; v_valid integer; v_old_import public.current_stock_imports; v_old_row_count numeric; v_old_litre numeric; v_new_row_count numeric; v_new_litre numeric;
begin
  perform public.require_current_stock_capability('stock.current.validate');
  select * into v_batch from public.import_batches where id=p_batch_id and created_by=auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode='P0002'; end if;
  if v_batch.source_kind<>'CURRENT_STOCK_AVAILABLE' or v_batch.status<>'PARSED' then raise exception 'CURRENT_STOCK_VALIDATION_NOT_ALLOWED' using errcode='55000'; end if;
  perform public.transition_import_batch(p_batch_id,'VALIDATING','CURRENT_STOCK_VALIDATION_STARTED',gen_random_uuid(),p_correlation_id);
  insert into public.validation_runs(import_batch_id,status,source_contract_version_id,created_by) values(p_batch_id,'RUNNING',v_batch.source_contract_version_id,auth.uid()) returning * into v_run;
  if not exists(select 1 from public.current_stock_staging_items where import_batch_id=p_batch_id) then insert into public.data_quality_issues(validation_run_id,severity,blocks_publication,message_key) values(v_run.id,'BLOCKING',true,'EMPTY_STOCK_SNAPSHOT'); end if;
  update public.current_stock_staging_items s set product_variant_id=v.product_variant_id, resolution_state=case when v.product_variant_id is null then 'UNRESOLVED'::public.current_stock_resolution_state else 'RESOLVED'::public.current_stock_resolution_state end from public.product_variants v where s.import_batch_id=p_batch_id and v.material_code=s.material_code;
  insert into public.data_quality_issues(validation_run_id,severity,blocks_publication,message_key,details)
  select v_run.id,'WARNING',false,'UNKNOWN_PRODUCT_VARIANT',jsonb_build_object('materialCode',material_code) from public.current_stock_staging_items where import_batch_id=p_batch_id and product_variant_id is null;

  -- STK-018: Delta-check anomaly warning
  select count(*), coalesce(sum(s.available_quantity * l.litres_per_stock_unit), 0)
  into v_new_row_count, v_new_litre
  from public.current_stock_staging_items s
  left join lateral (select litres_per_stock_unit from public.product_litre_versions x where x.product_variant_id=s.product_variant_id and x.valid_from<=now() and (x.valid_to is null or x.valid_to>now()) order by x.valid_from desc limit 1) l on true
  where s.import_batch_id=p_batch_id;

  select * into v_old_import from public.current_stock_imports where is_active and warehouse_id=(select id from public.warehouses where warehouse_code='DEFAULT_WAREHOUSE');
  if v_old_import.id is not null then
    select count(*), coalesce(sum(available_quantity * litres_per_stock_unit), 0) into v_old_row_count, v_old_litre from public.current_stock_items where current_stock_import_id=v_old_import.id;
    if nullif(v_old_row_count, 0) is not null and (abs(v_new_row_count - v_old_row_count) / v_old_row_count) > 0.20 then
      insert into public.data_quality_issues(validation_run_id,severity,blocks_publication,message_key,details) values(v_run.id,'WARNING',false,'STK_018_ANOMALY_WARNING_ROW_COUNT',jsonb_build_object('old',v_old_row_count,'new',v_new_row_count));
    end if;
    if nullif(v_old_litre, 0) is not null and (abs(v_new_litre - v_old_litre) / v_old_litre) > 0.30 then
      insert into public.data_quality_issues(validation_run_id,severity,blocks_publication,message_key,details) values(v_run.id,'WARNING',false,'STK_018_ANOMALY_WARNING_LITRE',jsonb_build_object('old',v_old_litre,'new',v_new_litre));
    end if;
  end if;

  select count(*) into v_blocking from public.data_quality_issues where validation_run_id=v_run.id and blocks_publication;
  select count(*) into v_valid from public.current_stock_staging_items where import_batch_id=p_batch_id;
  update public.import_batches set active_validation_run_id=v_run.id,valid_row_count=v_valid,invalid_row_count=v_blocking where id=p_batch_id;
  perform set_config('app.import_validation_transition','on',true);
  update public.validation_runs set status=case when v_blocking>0 then 'FAILED' else 'SUCCEEDED' end, finished_at=now(), control_totals=jsonb_build_object('rowCount',v_valid,'uniqueCodes',v_valid,'sourceQuantity',(select coalesce(sum(available_quantity),0)::text from public.current_stock_staging_items where import_batch_id=p_batch_id)) where id=v_run.id;
  perform public.transition_import_batch(p_batch_id,case when v_blocking>0 then 'FAILED'::public.import_batch_status else 'VALIDATED'::public.import_batch_status end,case when v_blocking>0 then 'CURRENT_STOCK_VALIDATION_FAILED' else 'CURRENT_STOCK_VALIDATED' end,gen_random_uuid(),p_correlation_id);
  return jsonb_build_object('batchId',p_batch_id,'validationRunId',v_run.id,'status',case when v_blocking>0 then 'FAILED' else 'VALIDATED' end,'blockingIssueCount',v_blocking);
end; $$;

create or replace function public.publish_current_stock(p_batch_id uuid,p_expected_validation_run_id uuid,p_expected_active_import_id uuid,p_idempotency_key text,p_request_fingerprint text,p_correlation_id text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_existing public.import_request_idempotency; v_old public.current_stock_imports; v_new public.current_stock_imports; v_warehouse uuid; v_status public.current_stock_import_status;
begin
  perform public.require_current_stock_capability('stock.current.publish');
  perform pg_advisory_xact_lock(hashtextextended('CURRENT_STOCK_AVAILABLE:DEFAULT_WAREHOUSE',0));
  select * into v_existing from public.assert_import_idempotency('current-stock.publish',p_idempotency_key,p_request_fingerprint);
  if v_existing.id is not null then return v_existing.response_payload || jsonb_build_object('idempotentReplay',true); end if;
  select * into v_batch from public.import_batches where id=p_batch_id and created_by=auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode='P0002'; end if;
  if v_batch.status<>'VALIDATED' or v_batch.active_validation_run_id<>p_expected_validation_run_id then raise exception 'STALE_VALIDATION_RUN' using errcode='P0001'; end if;
  select * into v_run from public.validation_runs where id=p_expected_validation_run_id;
  if v_run.status<>'SUCCEEDED' or exists(select 1 from public.data_quality_issues where validation_run_id=v_run.id and blocks_publication) then raise exception 'BLOCKING_VALIDATION_ISSUES' using errcode='P0001'; end if;
  select id into v_warehouse from public.warehouses where warehouse_code='DEFAULT_WAREHOUSE'; select * into v_old from public.current_stock_imports where warehouse_id=v_warehouse and is_active for update;
  if (v_old.id is distinct from p_expected_active_import_id) then raise exception 'STALE_ACTIVE_SNAPSHOT' using errcode='P0001'; end if;
  perform public.transition_import_batch(p_batch_id,'PUBLISHING','CURRENT_STOCK_PUBLISH_STARTED',gen_random_uuid(),p_correlation_id);
  insert into public.current_stock_imports(import_batch_id,warehouse_id,as_of_at,cutoff_mode,validation_run_id,control_totals) values(p_batch_id,v_warehouse,now(),'UPLOAD_INSTANT',v_run.id,v_run.control_totals) returning * into v_new;
  insert into public.current_stock_items(current_stock_import_id,product_variant_id,material_code,material_name,available_quantity,quantity_uom,product_family_id,product_litre_version_id,litres_per_stock_unit,resolution_state,source_ref)
  select v_new.id,s.product_variant_id,s.material_code,s.material_name,s.available_quantity,l.quantity_uom,m.product_family_id,l.id,l.litres_per_stock_unit,
    case when s.product_variant_id is null then 'UNRESOLVED'::public.current_stock_resolution_state when l.id is null and s.available_quantity>0 then 'MISSING_LPU'::public.current_stock_resolution_state else 'RESOLVED'::public.current_stock_resolution_state end,s.source_ref
  from public.current_stock_staging_items s
  left join lateral(select * from public.product_family_membership_versions x where x.product_variant_id=s.product_variant_id and x.valid_from<=v_new.as_of_at and(x.valid_to is null or x.valid_to>v_new.as_of_at) order by x.valid_from desc limit 1)m on true
  left join lateral(select * from public.product_litre_versions x where x.product_variant_id=s.product_variant_id and x.valid_from<=v_new.as_of_at and(x.valid_to is null or x.valid_to>v_new.as_of_at) order by x.valid_from desc limit 1)l on true where s.import_batch_id=p_batch_id;
  select case when exists(select 1 from public.current_stock_items where current_stock_import_id=v_new.id and resolution_state in ('MISSING_LPU','UNIT_CONFLICT')) then 'PUBLISHED_WITH_EXCEPTIONS'::public.current_stock_import_status else 'ACTIVE'::public.current_stock_import_status end into v_status;
  if v_old.id is not null then update public.current_stock_imports set is_active=false,status='SUPERSEDED' where id=v_old.id; end if;
  update public.current_stock_imports set is_active=true,status=v_status,activated_at=now(),activated_by=auth.uid() where id=v_new.id;
  insert into public.current_stock_publication_events(previous_current_stock_import_id,current_stock_import_id,actor_id,idempotency_key,aggregate_control_totals,correlation_id) values(v_old.id,v_new.id,auth.uid(),p_idempotency_key,v_run.control_totals,p_correlation_id);
  update public.import_batches set status='PUBLISHED' where id=p_batch_id;
  insert into public.import_request_idempotency(actor_id,endpoint,idempotency_key,request_fingerprint,import_batch_id,response_payload) values(auth.uid(),'current-stock.publish',p_idempotency_key,p_request_fingerprint,p_batch_id,jsonb_build_object('batchId',p_batch_id,'currentStockImportId',v_new.id,'status',v_status));
  return jsonb_build_object('batchId',p_batch_id,'currentStockImportId',v_new.id,'status',v_status,'idempotentReplay',false);
end; $$;

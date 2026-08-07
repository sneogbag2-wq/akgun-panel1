-- Package 04: parser output is validated before overlap-aware publication.

create or replace function public.require_sellout_capability(p_capability text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.has_capability(auth.uid(),p_capability) then raise exception 'SELLOUT_CAPABILITY_REQUIRED' using errcode='42501'; end if;
end; $$;

create or replace function public.parse_sellout_batch(p_batch_id uuid,p_rows jsonb,p_parser_version text,p_correlation_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_batch public.import_batches; v_row jsonb; v_count integer:=0;
begin
  perform public.require_sellout_capability('sellout.upload');
  select * into v_batch from public.import_batches where id=p_batch_id and created_by=auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode='P0002'; end if;
  if v_batch.source_kind<>'SELLOUT_TRADITIONAL' or v_batch.status<>'HASH_VERIFIED' or jsonb_typeof(p_rows)<>'array' or btrim(coalesce(p_parser_version,''))='' then raise exception 'SELLOUT_PARSE_NOT_ALLOWED' using errcode='55000'; end if;
  perform public.transition_import_batch(p_batch_id,'PARSING','SELLOUT_PARSE_STARTED',gen_random_uuid(),p_correlation_id);
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if coalesce(v_row->>'sheetName','')='' or coalesce(v_row->>'sourceRowNumber','') !~ '^[2-9][0-9]*$|^[1-9][0-9]{2,}$' or coalesce(v_row->>'rowSignature','') !~ '^[0-9a-f]{64}$' or coalesce(v_row->>'occurrenceOrdinal','') !~ '^[1-9][0-9]*$' then raise exception 'INVALID_SELLOUT_ROW' using errcode='22023'; end if;
    insert into public.sellout_staging_rows(import_batch_id,sheet_name,source_row_number,document_no,customer_code,material_code,material_name,billing_date,quantity,litres,movement_evidence,raw_payload,row_signature,occurrence_ordinal,parser_warnings)
    values(p_batch_id,v_row->>'sheetName',(v_row->>'sourceRowNumber')::int,nullif(v_row->>'documentNo',''),nullif(v_row->>'customerCode',''),nullif(v_row->>'materialCode',''),nullif(v_row->>'materialName',''),nullif(v_row->>'billingDate','')::date,nullif(v_row->>'quantity','')::numeric,nullif(v_row->>'litres','')::numeric,nullif(v_row->>'movementEvidence',''),coalesce(v_row->'rawPayload','{}'::jsonb),v_row->>'rowSignature',(v_row->>'occurrenceOrdinal')::int,coalesce(v_row->'warnings','[]'::jsonb));
    v_count:=v_count+1;
  end loop;
  update public.import_batches set read_row_count=v_count where id=p_batch_id;
  perform public.transition_import_batch(p_batch_id,'PARSED','SELLOUT_PARSE_COMPLETED',gen_random_uuid(),p_correlation_id);
  return jsonb_build_object('batchId',p_batch_id,'status','PARSED','readRowCount',v_count);
end; $$;

create or replace function public.validate_sellout_batch(p_batch_id uuid,p_correlation_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_blocking int; v_valid int; v_from date; v_to date;
begin
  perform public.require_sellout_capability('sellout.validate'); select * into v_batch from public.import_batches where id=p_batch_id and created_by=auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode='P0002'; end if;
  if v_batch.source_kind<>'SELLOUT_TRADITIONAL' or v_batch.status<>'PARSED' then raise exception 'SELLOUT_VALIDATION_NOT_ALLOWED' using errcode='55000'; end if;
  perform public.transition_import_batch(p_batch_id,'VALIDATING','SELLOUT_VALIDATION_STARTED',gen_random_uuid(),p_correlation_id);
  insert into public.validation_runs(import_batch_id,status,source_contract_version_id,created_by) values(p_batch_id,'RUNNING',v_batch.source_contract_version_id,auth.uid()) returning * into v_run;
  update public.sellout_staging_rows set validation_state='VALID',validation_reason=null where import_batch_id=p_batch_id and document_no is not null and customer_code ~ '^500[0-9]+$' and material_code is not null and billing_date is not null and quantity is not null and litres is not null and ((quantity>0 and litres>0) or (quantity<0 and litres<0));
  update public.sellout_staging_rows set validation_state='INVALID',validation_reason='INVALID_REQUIRED_OR_SIGN_FIELDS' where import_batch_id=p_batch_id and validation_state='PENDING';
  insert into public.data_quality_issues(validation_run_id,severity,blocks_publication,message_key,details)
  select v_run.id,'WARNING',false,validation_reason,jsonb_build_object('rowNumber',source_row_number) from public.sellout_staging_rows where import_batch_id=p_batch_id and validation_state='INVALID';
  insert into public.data_quality_issues(validation_run_id,severity,blocks_publication,message_key,details)
  select v_run.id,'WARNING',false,'UNKNOWN_CUSTOMER',jsonb_build_object('customerCode',s.customer_code) from public.sellout_staging_rows s left join public.customers c on c.customer_code=s.customer_code where s.import_batch_id=p_batch_id and s.validation_state='VALID' and c.customer_id is null;
  select min(billing_date),max(billing_date),count(*) filter(where validation_state='VALID')::int into v_from,v_to,v_valid from public.sellout_staging_rows where import_batch_id=p_batch_id;
  if v_valid=0 then insert into public.data_quality_issues(validation_run_id,severity,blocks_publication,message_key) values(v_run.id,'BLOCKING',true,'NO_VALID_SELLOUT_ROWS'); end if;
  select count(*) into v_blocking from public.data_quality_issues where validation_run_id=v_run.id and blocks_publication;
  insert into public.sellout_imports(import_batch_id,coverage_from,coverage_to,coverage_confirmed,validation_run_id,control_totals)
  values(p_batch_id,coalesce((v_batch.scope_payload->>'coverageFrom')::date,v_from),coalesce((v_batch.scope_payload->>'coverageTo')::date,v_to),coalesce((v_batch.scope_payload->>'coverageConfirmation')::boolean,false),v_run.id,jsonb_build_object('validRowCount',v_valid,'invalidRowCount',(select count(*) from public.sellout_staging_rows where import_batch_id=p_batch_id and validation_state='INVALID')))
  on conflict(import_batch_id) do update set validation_run_id=excluded.validation_run_id,control_totals=excluded.control_totals;
  update public.import_batches set active_validation_run_id=v_run.id,valid_row_count=v_valid,invalid_row_count=(select count(*) from public.sellout_staging_rows where import_batch_id=p_batch_id and validation_state='INVALID') where id=p_batch_id;
  perform set_config('app.import_validation_transition','on',true); update public.validation_runs set status=case when v_blocking>0 then 'FAILED' else 'SUCCEEDED' end,finished_at=now(),control_totals=jsonb_build_object('validRowCount',v_valid,'coverageFrom',v_from,'coverageTo',v_to) where id=v_run.id;
  perform public.transition_import_batch(p_batch_id,case when v_blocking>0 then 'FAILED'::public.import_batch_status else 'VALIDATED'::public.import_batch_status end,case when v_blocking>0 then 'SELLOUT_VALIDATION_FAILED' else 'SELLOUT_VALIDATED' end,gen_random_uuid(),p_correlation_id);
  return jsonb_build_object('batchId',p_batch_id,'validationRunId',v_run.id,'status',case when v_blocking>0 then 'FAILED' else 'VALIDATED' end,'validRowCount',v_valid);
end; $$;

create or replace function public.publish_sellout_overlap(p_batch_id uuid,p_validation_run_id uuid,p_expected_coverage_version integer,p_idempotency_key text,p_request_fingerprint text,p_correlation_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_batch public.import_batches; v_import public.sellout_imports; v_existing public.import_request_idempotency; v_added int; v_run uuid; v_month date; v_response jsonb;
begin
  perform public.require_sellout_capability('sellout.publish'); perform pg_advisory_xact_lock(hashtextextended('SELLOUT_TRADITIONAL',0));
  select * into v_existing from public.assert_import_idempotency('sellout.publish',p_idempotency_key,p_request_fingerprint); if v_existing.id is not null then return v_existing.response_payload || jsonb_build_object('idempotentReplay',true); end if;
  select * into v_batch from public.import_batches where id=p_batch_id and created_by=auth.uid() for update;
  if not found or v_batch.status<>'VALIDATED' or v_batch.active_validation_run_id<>p_validation_run_id then raise exception 'STALE_VALIDATION_RUN' using errcode='P0001'; end if;
  select * into v_import from public.sellout_imports where import_batch_id=p_batch_id; if not found or not v_import.coverage_confirmed then raise exception 'SELLOUT_COVERAGE_CONFIRMATION_REQUIRED' using errcode='P0001'; end if;
  perform public.transition_import_batch(p_batch_id,'PUBLISHING','SELLOUT_PUBLISH_STARTED',gen_random_uuid(),p_correlation_id);
  insert into public.sellout_line_observations(import_batch_id,staging_row_id,row_signature,occurrence_ordinal,customer_code,document_no,material_code,billing_date,quantity,litres,movement_evidence,raw_payload)
  select s.import_batch_id,s.id,s.row_signature,s.occurrence_ordinal,s.customer_code,s.document_no,s.material_code,s.billing_date,s.quantity,s.litres,s.movement_evidence,s.raw_payload
  from public.sellout_staging_rows s where s.import_batch_id=p_batch_id and s.validation_state='VALID'
  on conflict(row_signature,occurrence_ordinal) do nothing;
  get diagnostics v_added=row_count;
  insert into public.sellout_document_events(customer_id,document_no,billing_date)
  select c.customer_id,o.document_no,o.billing_date from public.sellout_line_observations o join public.customers c on c.customer_code=o.customer_code where o.import_batch_id=p_batch_id and o.document_no is not null
  on conflict(customer_id,document_no,billing_date) do nothing;
  insert into public.sellout_line_events(observation_id,document_event_id,customer_id,product_variant_id,product_family_id,billing_date,quantity,litres,movement_type,included_in_official_net)
  select o.id,d.id,c.customer_id,p.product_variant_id,m.product_family_id,o.billing_date,o.quantity,o.litres,
    case when o.quantity>0 and o.litres>0 then 'POSITIVE_SALE'::public.sellout_movement_type when o.movement_evidence='PRODUCT_RETURN' then 'PRODUCT_RETURN'::public.sellout_movement_type else 'UNCLASSIFIED_NEGATIVE'::public.sellout_movement_type end,
    (o.quantity>0 and o.litres>0) or coalesce((o.quantity<0 and o.litres<0 and o.movement_evidence='PRODUCT_RETURN'),false)
  from public.sellout_line_observations o left join public.customers c on c.customer_code=o.customer_code left join public.product_variants p on p.material_code=o.material_code
  left join lateral(select * from public.product_family_membership_versions x where x.product_variant_id=p.product_variant_id and x.valid_from<=o.billing_date::timestamptz and(x.valid_to is null or x.valid_to>o.billing_date::timestamptz) order by x.valid_from desc limit 1)m on true
  left join public.sellout_document_events d on d.customer_id=c.customer_id and d.document_no=o.document_no and d.billing_date=o.billing_date where o.import_batch_id=p_batch_id
  on conflict(observation_id) do nothing;
  insert into public.sellout_line_event_versions(sellout_line_event_id,version_no,movement_type,included_in_official_net,created_by)
  select e.id,1,e.movement_type,e.included_in_official_net,auth.uid()
  from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id
  where o.import_batch_id=p_batch_id
  on conflict(sellout_line_event_id,version_no) do nothing;
  insert into public.sellout_responsibility_components(sellout_line_event_id,customer_status,channel,rep_person_id,ssm_person_id,resolution_state,exclusion_reason)
  select e.id,st.status,ch.channel,rep.rep_person_id,ssm.ssm_person_id,
    case when c.customer_id is null then 'EXCLUDED'::public.sellout_resolution_state when st.status='ACTIVE' then 'RESOLVED'::public.sellout_resolution_state else 'EXCLUDED'::public.sellout_resolution_state end,
    case when c.customer_id is null then 'CUSTOMER_NOT_IN_MASTER' when st.status is distinct from 'ACTIVE' then 'CUSTOMER_NOT_ACTIVE' end
  from public.sellout_line_events e left join public.customers c on c.customer_id=e.customer_id
  left join lateral(select * from public.customer_status_versions x where x.customer_id=c.customer_id and x.valid_from<=e.billing_date::timestamptz and(x.valid_to is null or x.valid_to>e.billing_date::timestamptz) order by x.valid_from desc limit 1)st on true
  left join lateral(select cd.channel from public.customer_channel_assignments x join public.channel_definitions cd on cd.id=x.channel_id where x.customer_id=c.customer_id and x.valid_from<=e.billing_date::timestamptz and(x.valid_to is null or x.valid_to>e.billing_date::timestamptz) order by x.valid_from desc limit 1)ch on true
  left join lateral(select * from public.customer_rep_assignments x where x.customer_id=c.customer_id and x.valid_from<=e.billing_date::timestamptz and(x.valid_to is null or x.valid_to>e.billing_date::timestamptz) order by x.valid_from desc limit 1)rep on true
  left join lateral(select * from public.rep_ssm_assignments x where x.rep_person_id=rep.rep_person_id and x.valid_from<=e.billing_date::timestamptz and(x.valid_to is null or x.valid_to>e.billing_date::timestamptz) order by x.valid_from desc limit 1)ssm on true
  where e.observation_id in(select id from public.sellout_line_observations where import_batch_id=p_batch_id) on conflict(sellout_line_event_id) do nothing;
  insert into public.sellout_coverage_days(import_batch_id,coverage_date,coverage_state) select p_batch_id,d,case when exists(select 1 from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id where o.import_batch_id=p_batch_id and e.billing_date=d) then 'OBSERVED'::public.sellout_coverage_state else 'ZERO'::public.sellout_coverage_state end from generate_series(v_import.coverage_from,v_import.coverage_to,'1 day'::interval)d;
  insert into public.sellout_classification_runs(import_batch_id,rule_version,status) values(p_batch_id,'sellout-classification-v2/1.0.0',case when exists(select 1 from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id where o.import_batch_id=p_batch_id and e.movement_type='UNCLASSIFIED_NEGATIVE') then 'SUCCEEDED_WITH_EXCEPTIONS' else 'SUCCEEDED' end) returning id into v_run;
  insert into public.product_measurement_evidence(product_variant_id,evidence_kind,source_batch_id,observed_from,observed_to,positive_row_count,sum_quantity,sum_litres,provenance)
  select e.product_variant_id,'SELLOUT',p_batch_id,min(e.billing_date)::timestamptz,max(e.billing_date)::timestamptz,count(*)::int,sum(e.quantity),sum(e.litres),jsonb_build_object('package','04') from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id where o.import_batch_id=p_batch_id and e.movement_type='POSITIVE_SALE' and e.product_variant_id is not null group by e.product_variant_id;
  update public.sellout_imports set published_at=now(),published_by=auth.uid() where import_batch_id=p_batch_id;
  update public.import_batches set status='PUBLISHED' where id=p_batch_id;
  select date_trunc('month',min(billing_date))::date into v_month from public.sellout_line_observations where import_batch_id=p_batch_id;
  insert into public.sellout_calculation_runs(period_key,as_of_date,source_version_set,status) values(to_char(v_month,'YYYY-MM'),current_date,jsonb_build_object('importBatchId',p_batch_id,'classificationRunId',v_run),case when exists(select 1 from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id where o.import_batch_id=p_batch_id and e.movement_type='UNCLASSIFIED_NEGATIVE') then 'PARTIAL_CLASSIFICATION' else 'PUBLISHED' end);
  v_response:=jsonb_build_object('batchId',p_batch_id,'status','PUBLISHED','addedObservationCount',v_added,'classificationRunId',v_run,'idempotentReplay',false);
  insert into public.import_request_idempotency(actor_id,endpoint,idempotency_key,request_fingerprint,import_batch_id,response_payload) values(auth.uid(),'sellout.publish',p_idempotency_key,p_request_fingerprint,p_batch_id,v_response);
  return v_response;
end; $$;

-- Migration 53: Set-based batch parsing functions for high performance on 10,000+ rows
-- Package 01/02/03A/04 batch parse RPC refactoring: LOOP replaced by jsonb_to_recordset set-based INSERT ... SELECT

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

  with parsed_rows as (
    select
      r."sheetName" as sheet_name,
      r."sourceRowNumber" as source_row_number,
      r."rawCells" as raw_cells,
      r."rowHash" as row_hash,
      r."parsedPayload" as parsed_payload,
      r."parserWarnings" as parser_warnings,
      r."customerCodeCandidate" as customer_code_candidate,
      r."customerCodeValid" as customer_code_valid,
      row_number() over () as row_ordinal
    from jsonb_to_recordset(p_rows) as r(
      "sheetName" text,
      "sourceRowNumber" integer,
      "rawCells" jsonb,
      "rowHash" text,
      "parsedPayload" jsonb,
      "parserWarnings" jsonb,
      "customerCodeCandidate" text,
      "customerCodeValid" boolean
    )
  ),
  validated_rows as (
    select
      sheet_name,
      source_row_number,
      raw_cells,
      row_hash,
      parsed_payload,
      coalesce(parser_warnings, '[]'::jsonb) as parser_warnings,
      nullif(customer_code_candidate, '') as customer_code_candidate,
      coalesce(customer_code_valid, false) as customer_code_valid,
      row_ordinal
    from parsed_rows
    where
      coalesce(sheet_name, '') <> ''
      and source_row_number is not null and source_row_number > 0
      and jsonb_typeof(raw_cells) = 'object'
      and coalesce(row_hash, '') ~ '^[0-9a-f]{64}$'
      and jsonb_typeof(parsed_payload) = 'object'
      and jsonb_typeof(coalesce(parser_warnings, '[]'::jsonb)) = 'array'
  ),
  inserted_raw as (
    insert into public.raw_source_rows (import_batch_id, sheet_name, source_row_number, raw_cells, row_hash)
    select p_batch_id, sheet_name, source_row_number, raw_cells, row_hash
    from validated_rows
    order by row_ordinal
    returning id as raw_source_row_id, sheet_name, source_row_number
  ),
  inserted_versions as (
    insert into public.source_record_versions (
      source_kind, source_record_key, version_no, record_fingerprint, staging_payload, import_batch_id, created_by
    )
    select
      'CUSTOMER_MASTER',
      p_batch_id::text || ':' || v.sheet_name || ':' || v.source_row_number::text,
      1,
      v.row_hash,
      v.parsed_payload,
      p_batch_id,
      auth.uid()
    from validated_rows v
    order by v.row_ordinal
    returning id as source_record_version_id, source_record_key
  ),
  inserted_version_raw_rows as (
    insert into public.source_record_version_raw_rows (source_record_version_id, raw_source_row_id)
    select v.source_record_version_id, r.raw_source_row_id
    from inserted_versions v
    join inserted_raw r on v.source_record_key = p_batch_id::text || ':' || r.sheet_name || ':' || r.source_row_number::text
    returning 1
  ),
  inserted_obs as (
    insert into public.customer_master_row_observations (
      import_batch_id, source_record_version_id, raw_source_row_id, sheet_name, source_row_number,
      customer_code_candidate, customer_code_valid, parsed_payload, parser_warnings
    )
    select
      p_batch_id,
      v.source_record_version_id,
      r.raw_source_row_id,
      val.sheet_name,
      val.source_row_number,
      val.customer_code_candidate,
      val.customer_code_valid,
      val.parsed_payload,
      val.parser_warnings
    from validated_rows val
    join inserted_raw r on r.sheet_name = val.sheet_name and r.source_row_number = val.source_row_number
    join inserted_versions v on v.source_record_key = p_batch_id::text || ':' || val.sheet_name || ':' || val.source_row_number::text
    returning 1
  )
  select count(*) into v_read_count from inserted_obs;

  if v_read_count <> jsonb_array_length(p_rows) then
    raise exception 'INVALID_CUSTOMER_MASTER_ROW' using errcode = '22023';
  end if;

  update public.import_batches set read_row_count = v_read_count, valid_row_count = 0, invalid_row_count = 0 where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED'::public.import_batch_status, 'CUSTOMER_MASTER_PARSE_COMPLETED', gen_random_uuid(), p_correlation_id,
    jsonb_build_object('parserVersion', p_parser_version, 'readRowCount', v_read_count));
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PARSED', 'readRowCount', v_read_count);
end;
$$;

create or replace function public.parse_current_stock_batch(p_batch_id uuid, p_rows jsonb, p_parser_version text, p_correlation_id text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_count integer:=0;
begin
  perform public.require_current_stock_capability('stock.current.upload');
  select * into v_batch from public.import_batches where id=p_batch_id and created_by=auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode='P0002'; end if;
  if v_batch.source_kind <> 'CURRENT_STOCK_AVAILABLE' or coalesce(v_batch.scope_payload->>'warehouseCode','') <> 'DEFAULT_WAREHOUSE' or v_batch.status <> 'HASH_VERIFIED' then raise exception 'CURRENT_STOCK_PARSE_NOT_ALLOWED' using errcode='55000'; end if;
  if jsonb_typeof(p_rows) <> 'array' or btrim(coalesce(p_parser_version,''))='' then raise exception 'INVALID_CURRENT_STOCK_PARSE_REQUEST' using errcode='22023'; end if;
  perform public.transition_import_batch(p_batch_id,'PARSING','CURRENT_STOCK_PARSE_STARTED',gen_random_uuid(),p_correlation_id);

  with parsed_rows as (
    select
      r."materialCode" as material_code,
      r."materialName" as material_name,
      r."availableQuantity" as available_quantity,
      r."sourceRef" as source_ref,
      r."rowHash" as row_hash,
      r."warnings" as warnings
    from jsonb_to_recordset(p_rows) as r(
      "materialCode" text,
      "materialName" text,
      "availableQuantity" text,
      "sourceRef" jsonb,
      "rowHash" text,
      "warnings" jsonb
    )
  ),
  validated_rows as (
    select
      material_code,
      material_name,
      available_quantity::numeric as available_quantity,
      coalesce(source_ref, '{}'::jsonb) as source_ref,
      row_hash,
      coalesce(warnings, '[]'::jsonb) as warnings
    from parsed_rows
    where
      coalesce(material_code, '') <> ''
      and coalesce(material_name, '') <> ''
      and coalesce(available_quantity, '') ~ '^[0-9]+(\.[0-9]+)?$'
      and coalesce(row_hash, '') ~ '^[0-9a-f]{64}$'
  ),
  inserted as (
    insert into public.current_stock_staging_items(import_batch_id,material_code,material_name,available_quantity,source_ref,row_hash,parser_warnings)
    select p_batch_id, material_code, material_name, available_quantity, source_ref, row_hash, warnings
    from validated_rows
    returning 1
  )
  select count(*) into v_count from inserted;

  if v_count <> jsonb_array_length(p_rows) then
    raise exception 'INVALID_CURRENT_STOCK_ROW' using errcode='22023';
  end if;

  update public.import_batches set read_row_count=v_count,valid_row_count=0,invalid_row_count=0 where id=p_batch_id;
  perform public.transition_import_batch(p_batch_id,'PARSED','CURRENT_STOCK_PARSE_COMPLETED',gen_random_uuid(),p_correlation_id,jsonb_build_object('parserVersion',p_parser_version));
  return jsonb_build_object('batchId',p_batch_id,'status','PARSED','readRowCount',v_count);
end; $$;

create or replace function public.parse_sellout_batch(p_batch_id uuid,p_rows jsonb,p_parser_version text,p_correlation_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_batch public.import_batches; v_count integer:=0;
begin
  perform public.require_sellout_capability('sellout.upload');
  select * into v_batch from public.import_batches where id=p_batch_id and created_by=auth.uid() for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode='P0002'; end if;
  if v_batch.source_kind<>'SELLOUT_TRADITIONAL' or v_batch.status<>'HASH_VERIFIED' or jsonb_typeof(p_rows)<>'array' or btrim(coalesce(p_parser_version,''))='' then raise exception 'SELLOUT_PARSE_NOT_ALLOWED' using errcode='55000'; end if;
  perform public.transition_import_batch(p_batch_id,'PARSING','SELLOUT_PARSE_STARTED',gen_random_uuid(),p_correlation_id);

  with parsed_rows as (
    select
      r."sheetName" as sheet_name,
      r."sourceRowNumber" as source_row_number,
      r."documentNo" as document_no,
      r."customerCode" as customer_code,
      r."materialCode" as material_code,
      r."materialName" as material_name,
      r."billingDate" as billing_date,
      r."quantity" as quantity,
      r."litres" as litres,
      r."movementEvidence" as movement_evidence,
      r."rawPayload" as raw_payload,
      r."rowSignature" as row_signature,
      r."occurrenceOrdinal" as occurrence_ordinal,
      r."warnings" as warnings
    from jsonb_to_recordset(p_rows) as r(
      "sheetName" text,
      "sourceRowNumber" text,
      "documentNo" text,
      "customerCode" text,
      "materialCode" text,
      "materialName" text,
      "billingDate" text,
      "quantity" text,
      "litres" text,
      "movementEvidence" text,
      "rawPayload" jsonb,
      "rowSignature" text,
      "occurrenceOrdinal" text,
      "warnings" jsonb
    )
  ),
  validated_rows as (
    select
      sheet_name,
      source_row_number::int as source_row_number,
      nullif(document_no, '') as document_no,
      nullif(customer_code, '') as customer_code,
      nullif(material_code, '') as material_code,
      nullif(material_name, '') as material_name,
      nullif(billing_date, '')::date as billing_date,
      nullif(quantity, '')::numeric as quantity,
      nullif(litres, '')::numeric as litres,
      nullif(movement_evidence, '') as movement_evidence,
      coalesce(raw_payload, '{}'::jsonb) as raw_payload,
      row_signature,
      occurrence_ordinal::int as occurrence_ordinal,
      coalesce(warnings, '[]'::jsonb) as parser_warnings
    from parsed_rows
    where
      coalesce(sheet_name, '') <> ''
      and (coalesce(source_row_number, '') ~ '^[2-9][0-9]*$' or coalesce(source_row_number, '') ~ '^[1-9][0-9]{2,}$')
      and coalesce(row_signature, '') ~ '^[0-9a-f]{64}$'
      and coalesce(occurrence_ordinal, '') ~ '^[1-9][0-9]*$'
  ),
  inserted as (
    insert into public.sellout_staging_rows(import_batch_id,sheet_name,source_row_number,document_no,customer_code,material_code,material_name,billing_date,quantity,litres,movement_evidence,raw_payload,row_signature,occurrence_ordinal,parser_warnings)
    select p_batch_id,sheet_name,source_row_number,document_no,customer_code,material_code,material_name,billing_date,quantity,litres,movement_evidence,raw_payload,row_signature,occurrence_ordinal,parser_warnings
    from validated_rows
    returning 1
  )
  select count(*) into v_count from inserted;

  if v_count <> jsonb_array_length(p_rows) then
    raise exception 'INVALID_SELLOUT_ROW' using errcode='22023';
  end if;

  update public.import_batches set read_row_count=v_count where id=p_batch_id;
  perform public.transition_import_batch(p_batch_id,'PARSED','SELLOUT_PARSE_COMPLETED',gen_random_uuid(),p_correlation_id);
  return jsonb_build_object('batchId',p_batch_id,'status','PARSED','readRowCount',v_count);
end; $$;

-- Migration 54: Invoice Pipeline (Package 07 / Sales Invoice Batch Pipeline)
-- Set-based parse, validate, and publish functions for Sales Invoices (public.invoices)

create table if not exists public.invoice_staging_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text not null,
  source_row_number integer not null,
  document_no text,
  customer_code text,
  customer_id uuid references public.customers(customer_id),
  billing_date date,
  amount numeric(30,12),
  quantity numeric(30,12),
  raw_payload jsonb not null default '{}'::jsonb,
  row_signature text not null,
  parser_warnings jsonb not null default '[]'::jsonb,
  validation_state text not null default 'PENDING',
  validation_reason text,
  created_at timestamptz not null default now()
);

alter table public.invoice_staging_rows enable row level security;

create policy invoice_staging_rows_select_policy on public.invoice_staging_rows
  for select to authenticated
  using (
    exists (
      select 1 from public.import_batches b
      where b.id = import_batch_id and b.created_by = auth.uid()
    )
  );

create policy invoice_staging_rows_insert_policy on public.invoice_staging_rows
  for insert to authenticated
  with check (
    exists (
      select 1 from public.import_batches b
      where b.id = import_batch_id and b.created_by = auth.uid()
    )
  );

create policy invoice_staging_rows_update_policy on public.invoice_staging_rows
  for update to authenticated
  using (
    exists (
      select 1 from public.import_batches b
      where b.id = import_batch_id and b.created_by = auth.uid()
    )
  );

create or replace function public.require_invoice_capability(p_capability text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and not public.has_capability(auth.uid(), p_capability) then 
    raise exception 'INVOICE_CAPABILITY_REQUIRED' using errcode = '42501'; 
  end if;
end; $$;

create or replace function public.parse_sales_batch(
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
  v_count integer := 0;
begin
  perform public.require_invoice_capability('invoice.upload');
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'SALES' or v_batch.status <> 'HASH_VERIFIED' or jsonb_typeof(p_rows) <> 'array' or btrim(coalesce(p_parser_version, '')) = '' then 
    raise exception 'SALES_PARSE_NOT_ALLOWED' using errcode = '55000'; 
  end if;

  perform public.transition_import_batch(p_batch_id, 'PARSING', 'SALES_PARSE_STARTED', gen_random_uuid(), p_correlation_id);

  with parsed_rows as (
    select
      r."sheetName" as sheet_name,
      r."sourceRowNumber" as source_row_number,
      r."documentNo" as document_no,
      r."customerCode" as customer_code,
      r."billingDate" as billing_date,
      r."amount" as amount,
      r."quantity" as quantity,
      r."rawPayload" as raw_payload,
      r."rowSignature" as row_signature,
      r."warnings" as warnings
    from jsonb_to_recordset(p_rows) as r(
      "sheetName" text,
      "sourceRowNumber" text,
      "documentNo" text,
      "customerCode" text,
      "billingDate" text,
      "amount" text,
      "quantity" text,
      "rawPayload" jsonb,
      "rowSignature" text,
      "warnings" jsonb
    )
  ),
  validated_rows as (
    select
      sheet_name,
      source_row_number::int as source_row_number,
      nullif(document_no, '') as document_no,
      nullif(customer_code, '') as customer_code,
      nullif(billing_date, '')::date as billing_date,
      nullif(amount, '')::numeric as amount,
      nullif(quantity, '')::numeric as quantity,
      coalesce(raw_payload, '{}'::jsonb) as raw_payload,
      row_signature,
      coalesce(warnings, '[]'::jsonb) as parser_warnings
    from parsed_rows
    where
      coalesce(sheet_name, '') <> ''
      and (coalesce(source_row_number, '') ~ '^[1-9][0-9]*$')
      and coalesce(row_signature, '') ~ '^[0-9a-f]{64}$'
  ),
  inserted as (
    insert into public.invoice_staging_rows(
      import_batch_id, sheet_name, source_row_number, document_no, customer_code, billing_date, amount, quantity, raw_payload, row_signature, parser_warnings
    )
    select p_batch_id, sheet_name, source_row_number, document_no, customer_code, billing_date, amount, quantity, raw_payload, row_signature, parser_warnings
    from validated_rows
    returning 1
  )
  select count(*) into v_count from inserted;

  if v_count <> jsonb_array_length(p_rows) then
    raise exception 'INVALID_SALES_ROW' using errcode = '22023';
  end if;

  update public.import_batches set read_row_count = v_count where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED', 'SALES_PARSE_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PARSED', 'readRowCount', v_count);
end; $$;

create or replace function public.validate_sales_batch(
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
  v_valid int;
begin
  perform public.require_invoice_capability('invoice.validate');
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'SALES' or v_batch.status <> 'PARSED' then 
    raise exception 'SALES_VALIDATION_NOT_ALLOWED' using errcode = '55000'; 
  end if;

  perform public.transition_import_batch(p_batch_id, 'VALIDATING', 'SALES_VALIDATION_STARTED', gen_random_uuid(), p_correlation_id);
  insert into public.validation_runs(import_batch_id, status, source_contract_version_id, created_by) 
  values(p_batch_id, 'RUNNING', v_batch.source_contract_version_id, auth.uid()) 
  returning * into v_run;

  -- Match customer_id from customer_code
  update public.invoice_staging_rows s
  set customer_id = c.customer_id
  from public.customers c
  where s.import_batch_id = p_batch_id and c.customer_code = s.customer_code;

  -- Mark valid rows
  update public.invoice_staging_rows
  set validation_state = 'VALID', validation_reason = null
  where import_batch_id = p_batch_id and document_no is not null and customer_id is not null and billing_date is not null and amount is not null;

  update public.invoice_staging_rows
  set validation_state = 'INVALID', validation_reason = 'MISSING_REQUIRED_FIELDS_OR_UNKNOWN_CUSTOMER'
  where import_batch_id = p_batch_id and validation_state = 'PENDING';

  select count(*) into v_valid from public.invoice_staging_rows where import_batch_id = p_batch_id and validation_state = 'VALID';

  update public.import_batches set valid_row_count = v_valid, invalid_row_count = (read_row_count - v_valid) where id = p_batch_id;
  update public.validation_runs set status = 'PASSED', finished_at = now() where id = v_run.id;
  perform public.transition_import_batch(p_batch_id, 'VALIDATED', 'SALES_VALIDATION_COMPLETED', gen_random_uuid(), p_correlation_id);

  return jsonb_build_object('batchId', p_batch_id, 'status', 'VALIDATED', 'validationRunId', v_run.id, 'validRowCount', v_valid);
end; $$;

create or replace function public.publish_sales_batch(
  p_batch_id uuid,
  p_validation_run_id uuid,
  p_idempotency_key text,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_published_count int := 0;
begin
  perform public.require_invoice_capability('invoice.publish');
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_batch.source_kind <> 'SALES' or v_batch.status <> 'VALIDATED' then 
    raise exception 'SALES_PUBLISH_NOT_ALLOWED' using errcode = '55000'; 
  end if;

  insert into public.invoices (customer_id, document_no, billing_date, amount, quantity, status, created_by)
  select customer_id, document_no, billing_date, amount, coalesce(quantity, 0), 'ACTIVE'::public.invoice_status, auth.uid()
  from public.invoice_staging_rows
  where import_batch_id = p_batch_id and validation_state = 'VALID'
  on conflict (document_no, customer_id) do update set
    billing_date = excluded.billing_date,
    amount = excluded.amount,
    quantity = excluded.quantity;

  get diagnostics v_published_count = row_count;

  perform public.transition_import_batch(p_batch_id, 'PUBLISHED', 'SALES_PUBLISH_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PUBLISHED', 'publishedRowCount', v_published_count);
end; $$;

revoke all on function public.require_invoice_capability(text), public.parse_sales_batch(uuid, jsonb, text, text), public.validate_sales_batch(uuid, text), public.publish_sales_batch(uuid, uuid, text, text) from public, anon;
grant execute on function public.parse_sales_batch(uuid, jsonb, text, text), public.validate_sales_batch(uuid, text), public.publish_sales_batch(uuid, uuid, text, text) to authenticated;

-- Migration 55: Remaining Import Pipelines (Faz 4)
-- Set-based RPCs & Staging Tables for Payments, Cheques, Dispatches, and Purchases

-- 1. Payments Staging
create table if not exists public.payment_staging_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text not null,
  source_row_number integer not null,
  payment_type text,
  customer_code text,
  customer_id uuid references public.customers(customer_id),
  payment_date date,
  amount numeric(30,12),
  reference_no text,
  raw_payload jsonb not null default '{}'::jsonb,
  row_signature text not null,
  parser_warnings jsonb not null default '[]'::jsonb,
  validation_state text not null default 'PENDING',
  validation_reason text,
  created_at timestamptz not null default now()
);
alter table public.payment_staging_rows enable row level security;
create policy payment_staging_rows_select_policy on public.payment_staging_rows for select to authenticated using (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));
create policy payment_staging_rows_insert_policy on public.payment_staging_rows for insert to authenticated with check (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));
create policy payment_staging_rows_update_policy on public.payment_staging_rows for update to authenticated using (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));

-- 2. Cheques Staging
create table if not exists public.cheque_staging_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text not null,
  source_row_number integer not null,
  cheque_type text,
  customer_code text,
  customer_id uuid references public.customers(customer_id),
  due_date date,
  amount numeric(30,12),
  cheque_number text,
  bank_name text,
  raw_payload jsonb not null default '{}'::jsonb,
  row_signature text not null,
  parser_warnings jsonb not null default '[]'::jsonb,
  validation_state text not null default 'PENDING',
  validation_reason text,
  created_at timestamptz not null default now()
);
alter table public.cheque_staging_rows enable row level security;
create policy cheque_staging_rows_select_policy on public.cheque_staging_rows for select to authenticated using (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));
create policy cheque_staging_rows_insert_policy on public.cheque_staging_rows for insert to authenticated with check (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));
create policy cheque_staging_rows_update_policy on public.cheque_staging_rows for update to authenticated using (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));

-- 3. Dispatches Staging
create table if not exists public.dispatch_staging_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text not null,
  source_row_number integer not null,
  dispatch_no text,
  customer_code text,
  customer_id uuid references public.customers(customer_id),
  dispatch_date date,
  item_code text,
  quantity numeric(30,12),
  amount numeric(30,12),
  raw_payload jsonb not null default '{}'::jsonb,
  row_signature text not null,
  parser_warnings jsonb not null default '[]'::jsonb,
  validation_state text not null default 'PENDING',
  validation_reason text,
  created_at timestamptz not null default now()
);
alter table public.dispatch_staging_rows enable row level security;
create policy dispatch_staging_rows_select_policy on public.dispatch_staging_rows for select to authenticated using (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));
create policy dispatch_staging_rows_insert_policy on public.dispatch_staging_rows for insert to authenticated with check (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));
create policy dispatch_staging_rows_update_policy on public.dispatch_staging_rows for update to authenticated using (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));

-- 4. Purchases Staging
create table if not exists public.purchase_staging_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text not null,
  source_row_number integer not null,
  document_no text,
  supplier_code text,
  customer_id uuid references public.customers(customer_id),
  purchase_date date,
  amount numeric(30,12),
  raw_payload jsonb not null default '{}'::jsonb,
  row_signature text not null,
  parser_warnings jsonb not null default '[]'::jsonb,
  validation_state text not null default 'PENDING',
  validation_reason text,
  created_at timestamptz not null default now()
);
alter table public.purchase_staging_rows enable row level security;
create policy purchase_staging_rows_select_policy on public.purchase_staging_rows for select to authenticated using (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));
create policy purchase_staging_rows_insert_policy on public.purchase_staging_rows for insert to authenticated with check (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));
create policy purchase_staging_rows_update_policy on public.purchase_staging_rows for update to authenticated using (exists (select 1 from public.import_batches b where b.id = import_batch_id and b.created_by = auth.uid()));

-- --- RPC Functions ---

-- Payment Batch RPCs
create or replace function public.parse_payment_batch(p_batch_id uuid, p_rows jsonb, p_parser_version text, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_count integer := 0;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.transition_import_batch(p_batch_id, 'PARSING', 'PAYMENT_PARSE_STARTED', gen_random_uuid(), p_correlation_id);
  with parsed as (
    select r."sheetName" as sheet_name, r."sourceRowNumber" as source_row_number, r."customerCode" as customer_code,
           r."paymentDate" as payment_date, r."amount" as amount, r."referenceNo" as reference_no,
           r."rawPayload" as raw_payload, r."rowSignature" as row_signature, r."warnings" as warnings
    from jsonb_to_recordset(p_rows) as r("sheetName" text, "sourceRowNumber" text, "customerCode" text, "paymentDate" text, "amount" text, "referenceNo" text, "rawPayload" jsonb, "rowSignature" text, "warnings" jsonb)
  ),
  inserted as (
    insert into public.payment_staging_rows(import_batch_id, sheet_name, source_row_number, customer_code, payment_date, amount, reference_no, raw_payload, row_signature, parser_warnings)
    select p_batch_id, sheet_name, source_row_number::int, nullif(customer_code, ''), nullif(payment_date, '')::date, nullif(amount, '')::numeric, nullif(reference_no, ''), coalesce(raw_payload, '{}'::jsonb), row_signature, coalesce(warnings, '[]'::jsonb)
    from parsed returning 1
  ) select count(*) into v_count from inserted;
  update public.import_batches set read_row_count = v_count where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED', 'PAYMENT_PARSE_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PARSED', 'readRowCount', v_count);
end; $$;

create or replace function public.validate_payment_batch(p_batch_id uuid, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_valid int;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  perform public.transition_import_batch(p_batch_id, 'VALIDATING', 'PAYMENT_VALIDATION_STARTED', gen_random_uuid(), p_correlation_id);
  insert into public.validation_runs(import_batch_id, status, source_contract_version_id, created_by) values(p_batch_id, 'RUNNING', v_batch.source_contract_version_id, auth.uid()) returning * into v_run;
  update public.payment_staging_rows s set customer_id = c.customer_id from public.customers c where s.import_batch_id = p_batch_id and c.customer_code = s.customer_code;
  update public.payment_staging_rows set validation_state = 'VALID' where import_batch_id = p_batch_id and customer_id is not null and amount is not null;
  update public.payment_staging_rows set validation_state = 'INVALID' where import_batch_id = p_batch_id and validation_state = 'PENDING';
  select count(*) into v_valid from public.payment_staging_rows where import_batch_id = p_batch_id and validation_state = 'VALID';
  update public.import_batches set valid_row_count = v_valid, invalid_row_count = (read_row_count - v_valid) where id = p_batch_id;
  update public.validation_runs set status = 'PASSED', finished_at = now() where id = v_run.id;
  perform public.transition_import_batch(p_batch_id, 'VALIDATED', 'PAYMENT_VALIDATION_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'VALIDATED', 'validationRunId', v_run.id, 'validRowCount', v_valid);
end; $$;

create or replace function public.publish_payment_batch(p_batch_id uuid, p_validation_run_id uuid, p_idempotency_key text, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_published_count int := 0;
begin
  insert into public.payments (customer_id, payment_date, amount, reference_no, status, created_by)
  select customer_id, coalesce(payment_date, CURRENT_DATE), amount, reference_no, 'ACTIVE'::public.payment_status, auth.uid()
  from public.payment_staging_rows where import_batch_id = p_batch_id and validation_state = 'VALID';
  get diagnostics v_published_count = row_count;
  perform public.transition_import_batch(p_batch_id, 'PUBLISHED', 'PAYMENT_PUBLISH_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PUBLISHED', 'publishedRowCount', v_published_count);
end; $$;

-- Cheque Batch RPCs
create or replace function public.parse_cheque_batch(p_batch_id uuid, p_rows jsonb, p_parser_version text, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_count integer := 0;
begin
  perform public.transition_import_batch(p_batch_id, 'PARSING', 'CHEQUE_PARSE_STARTED', gen_random_uuid(), p_correlation_id);
  with parsed as (
    select r."sheetName" as sheet_name, r."sourceRowNumber" as source_row_number, r."customerCode" as customer_code,
           r."dueDate" as due_date, r."amount" as amount, r."chequeNumber" as cheque_number, r."bankName" as bank_name,
           r."rawPayload" as raw_payload, r."rowSignature" as row_signature, r."warnings" as warnings
    from jsonb_to_recordset(p_rows) as r("sheetName" text, "sourceRowNumber" text, "customerCode" text, "dueDate" text, "amount" text, "chequeNumber" text, "bankName" text, "rawPayload" jsonb, "rowSignature" text, "warnings" jsonb)
  ),
  inserted as (
    insert into public.cheque_staging_rows(import_batch_id, sheet_name, source_row_number, customer_code, due_date, amount, cheque_number, bank_name, raw_payload, row_signature, parser_warnings)
    select p_batch_id, sheet_name, source_row_number::int, nullif(customer_code, ''), nullif(due_date, '')::date, nullif(amount, '')::numeric, nullif(cheque_number, ''), nullif(bank_name, ''), coalesce(raw_payload, '{}'::jsonb), row_signature, coalesce(warnings, '[]'::jsonb)
    from parsed returning 1
  ) select count(*) into v_count from inserted;
  update public.import_batches set read_row_count = v_count where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED', 'CHEQUE_PARSE_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PARSED', 'readRowCount', v_count);
end; $$;

create or replace function public.validate_cheque_batch(p_batch_id uuid, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_valid int;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  perform public.transition_import_batch(p_batch_id, 'VALIDATING', 'CHEQUE_VALIDATION_STARTED', gen_random_uuid(), p_correlation_id);
  insert into public.validation_runs(import_batch_id, status, source_contract_version_id, created_by) values(p_batch_id, 'RUNNING', v_batch.source_contract_version_id, auth.uid()) returning * into v_run;
  update public.cheque_staging_rows s set customer_id = c.customer_id from public.customers c where s.import_batch_id = p_batch_id and c.customer_code = s.customer_code;
  update public.cheque_staging_rows set validation_state = 'VALID' where import_batch_id = p_batch_id and customer_id is not null and amount is not null;
  update public.cheque_staging_rows set validation_state = 'INVALID' where import_batch_id = p_batch_id and validation_state = 'PENDING';
  select count(*) into v_valid from public.cheque_staging_rows where import_batch_id = p_batch_id and validation_state = 'VALID';
  update public.import_batches set valid_row_count = v_valid, invalid_row_count = (read_row_count - v_valid) where id = p_batch_id;
  update public.validation_runs set status = 'PASSED', finished_at = now() where id = v_run.id;
  perform public.transition_import_batch(p_batch_id, 'VALIDATED', 'CHEQUE_VALIDATION_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'VALIDATED', 'validationRunId', v_run.id, 'validRowCount', v_valid);
end; $$;

create or replace function public.publish_cheque_batch(p_batch_id uuid, p_validation_run_id uuid, p_idempotency_key text, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_published_count int := 0;
begin
  insert into public.cheques (customer_id, due_date, amount, cheque_number, bank_name, status, created_by)
  select customer_id, coalesce(due_date, CURRENT_DATE), amount, cheque_number, bank_name, 'PORTFOLIO'::public.cheque_status, auth.uid()
  from public.cheque_staging_rows where import_batch_id = p_batch_id and validation_state = 'VALID';
  get diagnostics v_published_count = row_count;
  perform public.transition_import_batch(p_batch_id, 'PUBLISHED', 'CHEQUE_PUBLISH_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PUBLISHED', 'publishedRowCount', v_published_count);
end; $$;

-- Dispatch Batch RPCs
create or replace function public.parse_dispatch_batch(p_batch_id uuid, p_rows jsonb, p_parser_version text, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_count integer := 0;
begin
  perform public.transition_import_batch(p_batch_id, 'PARSING', 'DISPATCH_PARSE_STARTED', gen_random_uuid(), p_correlation_id);
  with parsed as (
    select r."sheetName" as sheet_name, r."sourceRowNumber" as source_row_number, r."dispatchNo" as dispatch_no,
           r."customerCode" as customer_code, r."dispatchDate" as dispatch_date, r."itemCode" as item_code,
           r."quantity" as quantity, r."amount" as amount, r."rawPayload" as raw_payload, r."rowSignature" as row_signature, r."warnings" as warnings
    from jsonb_to_recordset(p_rows) as r("sheetName" text, "sourceRowNumber" text, "dispatchNo" text, "customerCode" text, "dispatchDate" text, "itemCode" text, "quantity" text, "amount" text, "rawPayload" jsonb, "rowSignature" text, "warnings" jsonb)
  ),
  inserted as (
    insert into public.dispatch_staging_rows(import_batch_id, sheet_name, source_row_number, dispatch_no, customer_code, dispatch_date, item_code, quantity, amount, raw_payload, row_signature, parser_warnings)
    select p_batch_id, sheet_name, source_row_number::int, nullif(dispatch_no, ''), nullif(customer_code, ''), nullif(dispatch_date, '')::date, nullif(item_code, ''), nullif(quantity, '')::numeric, nullif(amount, '')::numeric, coalesce(raw_payload, '{}'::jsonb), row_signature, coalesce(warnings, '[]'::jsonb)
    from parsed returning 1
  ) select count(*) into v_count from inserted;
  update public.import_batches set read_row_count = v_count where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED', 'DISPATCH_PARSE_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PARSED', 'readRowCount', v_count);
end; $$;

create or replace function public.validate_dispatch_batch(p_batch_id uuid, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_valid int;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  perform public.transition_import_batch(p_batch_id, 'VALIDATING', 'DISPATCH_VALIDATION_STARTED', gen_random_uuid(), p_correlation_id);
  insert into public.validation_runs(import_batch_id, status, source_contract_version_id, created_by) values(p_batch_id, 'RUNNING', v_batch.source_contract_version_id, auth.uid()) returning * into v_run;
  update public.dispatch_staging_rows s set customer_id = c.customer_id from public.customers c where s.import_batch_id = p_batch_id and c.customer_code = s.customer_code;
  update public.dispatch_staging_rows set validation_state = 'VALID' where import_batch_id = p_batch_id and customer_id is not null;
  update public.dispatch_staging_rows set validation_state = 'INVALID' where import_batch_id = p_batch_id and validation_state = 'PENDING';
  select count(*) into v_valid from public.dispatch_staging_rows where import_batch_id = p_batch_id and validation_state = 'VALID';
  update public.import_batches set valid_row_count = v_valid, invalid_row_count = (read_row_count - v_valid) where id = p_batch_id;
  update public.validation_runs set status = 'PASSED', finished_at = now() where id = v_run.id;
  perform public.transition_import_batch(p_batch_id, 'VALIDATED', 'DISPATCH_VALIDATION_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'VALIDATED', 'validationRunId', v_run.id, 'validRowCount', v_valid);
end; $$;

create or replace function public.publish_dispatch_batch(p_batch_id uuid, p_validation_run_id uuid, p_idempotency_key text, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_published_count int := 0;
begin
  insert into public.dispatches (customer_id, dispatch_no, dispatch_date, status, created_by)
  select distinct customer_id, coalesce(dispatch_no, 'DISP-' || gen_random_uuid()), coalesce(dispatch_date, CURRENT_DATE), 'DELIVERED'::public.dispatch_status, auth.uid()
  from public.dispatch_staging_rows where import_batch_id = p_batch_id and validation_state = 'VALID'
  on conflict (dispatch_no) do nothing;
  get diagnostics v_published_count = row_count;
  perform public.transition_import_batch(p_batch_id, 'PUBLISHED', 'DISPATCH_PUBLISH_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PUBLISHED', 'publishedRowCount', v_published_count);
end; $$;

-- Purchase Batch RPCs
create or replace function public.parse_purchase_batch(p_batch_id uuid, p_rows jsonb, p_parser_version text, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_count integer := 0;
begin
  perform public.transition_import_batch(p_batch_id, 'PARSING', 'PURCHASE_PARSE_STARTED', gen_random_uuid(), p_correlation_id);
  with parsed as (
    select r."sheetName" as sheet_name, r."sourceRowNumber" as source_row_number, r."documentNo" as document_no,
           r."supplierCode" as supplier_code, r."purchaseDate" as purchase_date, r."amount" as amount,
           r."rawPayload" as raw_payload, r."rowSignature" as row_signature, r."warnings" as warnings
    from jsonb_to_recordset(p_rows) as r("sheetName" text, "sourceRowNumber" text, "documentNo" text, "supplierCode" text, "purchaseDate" text, "amount" text, "rawPayload" jsonb, "rowSignature" text, "warnings" jsonb)
  ),
  inserted as (
    insert into public.purchase_staging_rows(import_batch_id, sheet_name, source_row_number, document_no, supplier_code, purchase_date, amount, raw_payload, row_signature, parser_warnings)
    select p_batch_id, sheet_name, source_row_number::int, nullif(document_no, ''), nullif(supplier_code, ''), nullif(purchase_date, '')::date, nullif(amount, '')::numeric, coalesce(raw_payload, '{}'::jsonb), row_signature, coalesce(warnings, '[]'::jsonb)
    from parsed returning 1
  ) select count(*) into v_count from inserted;
  update public.import_batches set read_row_count = v_count where id = p_batch_id;
  perform public.transition_import_batch(p_batch_id, 'PARSED', 'PURCHASE_PARSE_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PARSED', 'readRowCount', v_count);
end; $$;

create or replace function public.validate_purchase_batch(p_batch_id uuid, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.import_batches; v_run public.validation_runs; v_valid int;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  perform public.transition_import_batch(p_batch_id, 'VALIDATING', 'PURCHASE_VALIDATION_STARTED', gen_random_uuid(), p_correlation_id);
  insert into public.validation_runs(import_batch_id, status, source_contract_version_id, created_by) values(p_batch_id, 'RUNNING', v_batch.source_contract_version_id, auth.uid()) returning * into v_run;
  update public.purchase_staging_rows set validation_state = 'VALID' where import_batch_id = p_batch_id and amount is not null;
  update public.purchase_staging_rows set validation_state = 'INVALID' where import_batch_id = p_batch_id and validation_state = 'PENDING';
  select count(*) into v_valid from public.purchase_staging_rows where import_batch_id = p_batch_id and validation_state = 'VALID';
  update public.import_batches set valid_row_count = v_valid, invalid_row_count = (read_row_count - v_valid) where id = p_batch_id;
  update public.validation_runs set status = 'PASSED', finished_at = now() where id = v_run.id;
  perform public.transition_import_batch(p_batch_id, 'VALIDATED', 'PURCHASE_VALIDATION_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'VALIDATED', 'validationRunId', v_run.id, 'validRowCount', v_valid);
end; $$;

create or replace function public.publish_purchase_batch(p_batch_id uuid, p_validation_run_id uuid, p_idempotency_key text, p_correlation_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_published_count int := 0;
begin
  get diagnostics v_published_count = row_count;
  perform public.transition_import_batch(p_batch_id, 'PUBLISHED', 'PURCHASE_PUBLISH_COMPLETED', gen_random_uuid(), p_correlation_id);
  return jsonb_build_object('batchId', p_batch_id, 'status', 'PUBLISHED', 'publishedRowCount', v_published_count);
end; $$;

grant execute on function public.parse_payment_batch(uuid, jsonb, text, text), public.validate_payment_batch(uuid, text), public.publish_payment_batch(uuid, uuid, text, text) to authenticated;
grant execute on function public.parse_cheque_batch(uuid, jsonb, text, text), public.validate_cheque_batch(uuid, text), public.publish_cheque_batch(uuid, uuid, text, text) to authenticated;
grant execute on function public.parse_dispatch_batch(uuid, jsonb, text, text), public.validate_dispatch_batch(uuid, text), public.publish_dispatch_batch(uuid, uuid, text, text) to authenticated;
grant execute on function public.parse_purchase_batch(uuid, jsonb, text, text), public.validate_purchase_batch(uuid, text), public.publish_purchase_batch(uuid, uuid, text, text) to authenticated;

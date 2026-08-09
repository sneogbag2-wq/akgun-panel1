-- Package 01: immutable source-ingestion foundation.
-- This migration deliberately contains no business-source parser or metric logic.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.import_batch_status as enum (
  'INITIATED', 'UPLOADED', 'HASH_VERIFIED', 'PARSING', 'PARSED',
  'VALIDATING', 'VALIDATED', 'REVIEW_REQUIRED', 'APPROVED',
  'REJECTED', 'PUBLISHING', 'PUBLISHED', 'DUPLICATE', 'FAILED'
);

create type public.import_issue_severity as enum ('INFO', 'WARNING', 'ERROR', 'BLOCKING');
create type public.publication_mode as enum ('FULL_REPLACE', 'APPEND_ONLY', 'UPSERT_VERSIONED');

create table public.app_user_capabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  primary key (user_id, capability)
);

create table public.source_contract_versions (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind ~ '^[A-Z][A-Z0-9_]{1,127}$'),
  contract_version integer not null check (contract_version > 0),
  header_signature text not null check (btrim(header_signature) <> ''),
  required_fields jsonb not null check (jsonb_typeof(required_fields) = 'array'),
  parser_name text not null check (btrim(parser_name) <> ''),
  parser_version text not null check (btrim(parser_version) <> ''),
  effective_from timestamptz not null,
  effective_to timestamptz,
  status text not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  publication_mode public.publication_mode not null,
  empty_snapshot_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (source_kind, contract_version),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size >= 0),
  mime_type text not null check (btrim(mime_type) <> ''),
  storage_object_path text not null check (
    storage_object_path ~ '^imports/[0-9a-f-]{36}/[0-9a-f-]{36}$'
  ),
  original_file_name text not null check (btrim(original_file_name) <> ''),
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (sha256, byte_size),
  unique (storage_object_path)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid references public.source_files(id),
  source_kind text not null check (source_kind ~ '^[A-Z][A-Z0-9_]{1,127}$'),
  source_contract_version_id uuid not null references public.source_contract_versions(id),
  scope_key text not null check (btrim(scope_key) <> ''),
  scope_payload jsonb not null check (jsonb_typeof(scope_payload) = 'object'),
  status public.import_batch_status not null default 'INITIATED',
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  request_fingerprint char(64) not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  declared_sha256 char(64) not null check (declared_sha256 ~ '^[0-9a-f]{64}$'),
  declared_byte_size bigint not null check (declared_byte_size >= 0),
  original_file_name text not null check (btrim(original_file_name) <> ''),
  mime_type text not null check (btrim(mime_type) <> ''),
  storage_object_path text not null check (
    storage_object_path ~ '^imports/[0-9a-f-]{36}/[0-9a-f-]{36}$'
  ),
  duplicate_of_batch_id uuid references public.import_batches(id),
  retry_of_batch_id uuid references public.import_batches(id),
  expected_row_count integer check (expected_row_count is null or expected_row_count >= 0),
  read_row_count integer not null default 0 check (read_row_count >= 0),
  valid_row_count integer not null default 0 check (valid_row_count >= 0),
  invalid_row_count integer not null default 0 check (invalid_row_count >= 0),
  active_validation_run_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, idempotency_key),
  unique (storage_object_path)
);

create table public.raw_source_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  sheet_name text not null check (btrim(sheet_name) <> ''),
  source_row_number integer not null check (source_row_number > 0),
  raw_cells jsonb not null check (jsonb_typeof(raw_cells) = 'object'),
  row_hash char(64) not null check (row_hash ~ '^[0-9a-f]{64}$'),
  ingested_at timestamptz not null default now(),
  unique (import_batch_id, sheet_name, source_row_number)
);

create table public.source_record_versions (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind ~ '^[A-Z][A-Z0-9_]{1,127}$'),
  source_record_key text not null check (btrim(source_record_key) <> ''),
  version_no integer not null check (version_no > 0),
  record_fingerprint char(64) not null check (record_fingerprint ~ '^[0-9a-f]{64}$'),
  staging_payload jsonb not null check (jsonb_typeof(staging_payload) = 'object'),
  supersedes_version_id uuid references public.source_record_versions(id),
  import_batch_id uuid not null references public.import_batches(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (source_kind, source_record_key, version_no)
);

create table public.source_record_version_raw_rows (
  source_record_version_id uuid not null references public.source_record_versions(id),
  raw_source_row_id uuid not null references public.raw_source_rows(id),
  primary key (source_record_version_id, raw_source_row_id)
);

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id text not null check (btrim(rule_id) <> ''),
  version integer not null check (version > 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  rule_hash char(64) not null check (rule_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (rule_id, version),
  check (effective_to is null or effective_to >= effective_from),
  exclude using gist (
    rule_id with =,
    tstzrange(effective_from, effective_to, '[)') with &&
  )
);

create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  status text not null check (status in ('RUNNING', 'SUCCEEDED', 'REVIEW_REQUIRED', 'FAILED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_contract_version_id uuid not null references public.source_contract_versions(id),
  control_totals jsonb not null default '{}'::jsonb check (jsonb_typeof(control_totals) = 'object'),
  created_by uuid not null references auth.users(id),
  check ((status in ('RUNNING') and finished_at is null) or (status <> 'RUNNING' and finished_at is not null))
);

alter table public.import_batches
  add constraint import_batches_active_validation_run_id_fkey
  foreign key (active_validation_run_id) references public.validation_runs(id);

create table public.validation_run_rule_versions (
  validation_run_id uuid not null references public.validation_runs(id),
  rule_version_id uuid not null references public.rule_versions(id),
  primary key (validation_run_id, rule_version_id)
);

create table public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.validation_runs(id),
  rule_version_id uuid references public.rule_versions(id),
  severity public.import_issue_severity not null,
  blocks_publication boolean not null,
  message_key text not null check (btrim(message_key) <> ''),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  affected_field text,
  source_ref jsonb,
  created_at timestamptz not null default now(),
  check ((severity = 'BLOCKING') = blocks_publication)
);

create table public.publication_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind ~ '^[A-Z][A-Z0-9_]{1,127}$'),
  scope_key text not null check (btrim(scope_key) <> ''),
  import_batch_id uuid not null references public.import_batches(id),
  validation_run_id uuid not null references public.validation_runs(id),
  snapshot_version integer not null check (snapshot_version > 0),
  is_active boolean not null default false,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  previous_snapshot_id uuid references public.publication_snapshots(id),
  control_totals jsonb not null default '{}'::jsonb check (jsonb_typeof(control_totals) = 'object'),
  unique (source_kind, scope_key, snapshot_version)
);

create unique index publication_snapshots_one_active_scope_idx
  on public.publication_snapshots (source_kind, scope_key)
  where is_active;

create table public.publication_snapshot_items (
  publication_snapshot_id uuid not null references public.publication_snapshots(id),
  source_record_version_id uuid not null references public.source_record_versions(id),
  primary key (publication_snapshot_id, source_record_version_id)
);

create table public.import_state_events (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  previous_status public.import_batch_status,
  new_status public.import_batch_status not null,
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now(),
  reason_code text not null check (btrim(reason_code) <> ''),
  request_id uuid not null default gen_random_uuid(),
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create table public.import_request_idempotency (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  endpoint text not null check (btrim(endpoint) <> ''),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  request_fingerprint char(64) not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  import_batch_id uuid references public.import_batches(id),
  publication_snapshot_id uuid references public.publication_snapshots(id),
  response_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(response_payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (actor_id, endpoint, idempotency_key)
);

create index import_batches_scope_status_idx on public.import_batches (source_kind, scope_key, status);
create index raw_source_rows_batch_idx on public.raw_source_rows (import_batch_id);
create index source_record_versions_batch_idx on public.source_record_versions (import_batch_id);
create index validation_runs_batch_idx on public.validation_runs (import_batch_id, started_at desc);
create index data_quality_issues_run_idx on public.data_quality_issues (validation_run_id, severity);
create index import_state_events_batch_idx on public.import_state_events (import_batch_id, occurred_at);
-- Package 01: state-machine, provenance and append-only enforcement.

create or replace function public.prevent_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'IMMUTABLE_RECORD' using errcode = '55000';
end;
$$;

create or replace function public.touch_import_batch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and current_setting('app.import_state_transition', true) is distinct from 'on' then
    raise exception 'DIRECT_STATE_UPDATE_FORBIDDEN' using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prevent_import_batch_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'IMPORT_BATCH_DELETE_FORBIDDEN' using errcode = '55000';
end;
$$;

create or replace function public.allow_validation_run_completion_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('app.import_validation_transition', true) is distinct from 'on' then
    raise exception 'VALIDATION_RUN_IMMUTABLE' using errcode = '55000';
  end if;
  if old.import_batch_id is distinct from new.import_batch_id
     or old.source_contract_version_id is distinct from new.source_contract_version_id
     or old.started_at is distinct from new.started_at
     or old.created_by is distinct from new.created_by
     or old.status <> 'RUNNING'
     or new.status not in ('SUCCEEDED', 'REVIEW_REQUIRED', 'FAILED')
     or new.finished_at is null then
    raise exception 'INVALID_VALIDATION_RUN_UPDATE' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.allow_snapshot_deactivation_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('app.import_publish', true) is distinct from 'on'
     or old.is_active is not true
     or new.is_active is not false
     or old.id is distinct from new.id
     or old.source_kind is distinct from new.source_kind
     or old.scope_key is distinct from new.scope_key
     or old.import_batch_id is distinct from new.import_batch_id
     or old.validation_run_id is distinct from new.validation_run_id
     or old.snapshot_version is distinct from new.snapshot_version
     or old.published_by is distinct from new.published_by
     or old.published_at is distinct from new.published_at
     or old.previous_snapshot_id is distinct from new.previous_snapshot_id
     or old.control_totals is distinct from new.control_totals then
    raise exception 'PUBLICATION_SNAPSHOT_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.is_valid_import_transition(
  p_from public.import_batch_status,
  p_to public.import_batch_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('INITIATED'::public.import_batch_status, 'UPLOADED'::public.import_batch_status),
    ('UPLOADED'::public.import_batch_status, 'HASH_VERIFIED'::public.import_batch_status),
    ('UPLOADED'::public.import_batch_status, 'FAILED'::public.import_batch_status),
    ('HASH_VERIFIED'::public.import_batch_status, 'PARSING'::public.import_batch_status),
    ('HASH_VERIFIED'::public.import_batch_status, 'DUPLICATE'::public.import_batch_status),
    ('PARSING'::public.import_batch_status, 'PARSED'::public.import_batch_status),
    ('PARSING'::public.import_batch_status, 'FAILED'::public.import_batch_status),
    ('PARSED'::public.import_batch_status, 'VALIDATING'::public.import_batch_status),
    ('VALIDATING'::public.import_batch_status, 'VALIDATED'::public.import_batch_status),
    ('VALIDATING'::public.import_batch_status, 'REVIEW_REQUIRED'::public.import_batch_status),
    ('VALIDATING'::public.import_batch_status, 'FAILED'::public.import_batch_status),
    ('REVIEW_REQUIRED'::public.import_batch_status, 'APPROVED'::public.import_batch_status),
    ('REVIEW_REQUIRED'::public.import_batch_status, 'REJECTED'::public.import_batch_status),
    ('VALIDATED'::public.import_batch_status, 'PUBLISHING'::public.import_batch_status),
    ('APPROVED'::public.import_batch_status, 'PUBLISHING'::public.import_batch_status),
    ('PUBLISHING'::public.import_batch_status, 'PUBLISHED'::public.import_batch_status)
  );
$$;

create or replace function public.transition_import_batch(
  p_batch_id uuid,
  p_to public.import_batch_status,
  p_reason_code text,
  p_request_id uuid default gen_random_uuid(),
  p_correlation_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_previous_status public.import_batch_status;
begin
  select * into v_batch
  from public.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_status := v_batch.status;
  if not public.is_valid_import_transition(v_previous_status, p_to) then
    raise exception 'INVALID_IMPORT_STATE_TRANSITION' using errcode = '55000';
  end if;

  perform set_config('app.import_state_transition', 'on', true);
  update public.import_batches
  set status = p_to
  where id = p_batch_id
  returning * into v_batch;

  insert into public.import_state_events (
    import_batch_id, previous_status, new_status, actor_id, reason_code,
    request_id, correlation_id, metadata
  ) values (
    p_batch_id, v_previous_status, p_to, auth.uid(), p_reason_code,
    p_request_id, p_correlation_id, coalesce(p_metadata, '{}'::jsonb)
  );

  return v_batch;
end;
$$;

create trigger import_batches_touch_trigger
before update on public.import_batches
for each row execute function public.touch_import_batch();

create trigger import_batches_no_delete_trigger
before delete on public.import_batches
for each row execute function public.prevent_import_batch_delete();

create trigger source_files_immutable_trigger
before update or delete on public.source_files
for each row execute function public.prevent_immutable_change();

create trigger raw_source_rows_immutable_trigger
before update or delete on public.raw_source_rows
for each row execute function public.prevent_immutable_change();

create trigger source_record_versions_immutable_trigger
before update or delete on public.source_record_versions
for each row execute function public.prevent_immutable_change();

create trigger source_record_version_raw_rows_immutable_trigger
before update or delete on public.source_record_version_raw_rows
for each row execute function public.prevent_immutable_change();

create trigger validation_runs_completion_only_trigger
before update on public.validation_runs
for each row execute function public.allow_validation_run_completion_only();

create trigger validation_runs_no_delete_trigger
before delete on public.validation_runs
for each row execute function public.prevent_immutable_change();

create trigger validation_run_rule_versions_immutable_trigger
before update or delete on public.validation_run_rule_versions
for each row execute function public.prevent_immutable_change();

create trigger data_quality_issues_immutable_trigger
before update or delete on public.data_quality_issues
for each row execute function public.prevent_immutable_change();

create trigger publication_snapshots_immutable_trigger
before update on public.publication_snapshots
for each row execute function public.allow_snapshot_deactivation_only();

create trigger publication_snapshots_no_delete_trigger
before delete on public.publication_snapshots
for each row execute function public.prevent_immutable_change();

create trigger publication_snapshot_items_immutable_trigger
before update or delete on public.publication_snapshot_items
for each row execute function public.prevent_immutable_change();

create trigger import_state_events_immutable_trigger
before update or delete on public.import_state_events
for each row execute function public.prevent_immutable_change();

create trigger import_request_idempotency_immutable_trigger
before update or delete on public.import_request_idempotency
for each row execute function public.prevent_immutable_change();

create trigger source_contract_versions_immutable_trigger
before update or delete on public.source_contract_versions
for each row execute function public.prevent_immutable_change();

create trigger rule_versions_immutable_trigger
before update or delete on public.rule_versions
for each row execute function public.prevent_immutable_change();
-- Package 01: fail-closed access controls.  All domain writes are RPC-only.

create or replace function public.has_capability(p_user_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
     and p_user_id = auth.uid()
     and exists (
       select 1
       from public.app_user_capabilities c
       where c.user_id = p_user_id
         and c.capability = p_capability
     );
$$;

revoke all on function public.has_capability(uuid, text) from public, anon;
grant execute on function public.has_capability(uuid, text) to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'app_user_capabilities', 'source_contract_versions', 'source_files',
    'import_batches', 'raw_source_rows', 'source_record_versions',
    'source_record_version_raw_rows', 'rule_versions', 'validation_runs',
    'validation_run_rule_versions', 'data_quality_issues',
    'publication_snapshots', 'publication_snapshot_items',
    'import_state_events', 'import_request_idempotency'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant usage on schema public to authenticated;
grant select on public.source_contract_versions, public.import_batches,
  public.validation_runs, public.data_quality_issues, public.publication_snapshots
to authenticated;

create policy app_user_capabilities_self_audit
on public.app_user_capabilities
for select to authenticated
using (user_id = auth.uid() and public.has_capability(auth.uid(), 'import.audit'));

create policy source_contract_versions_view
on public.source_contract_versions
for select to authenticated
using (public.has_capability(auth.uid(), 'import.view'));

create policy source_contract_versions_audit
on public.source_contract_versions
for select to authenticated
using (public.has_capability(auth.uid(), 'import.audit'));

create policy import_batches_view_own
on public.import_batches
for select to authenticated
using (
  created_by = auth.uid()
  and public.has_capability(auth.uid(), 'import.view')
);

create policy source_files_audit_own_batch
on public.source_files
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1 from public.import_batches b
    where b.source_file_id = source_files.id
      and b.created_by = auth.uid()
  )
);

create policy raw_source_rows_audit_own_batch
on public.raw_source_rows
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1 from public.import_batches b
    where b.id = raw_source_rows.import_batch_id
      and b.created_by = auth.uid()
  )
);

create policy source_record_versions_audit_own_batch
on public.source_record_versions
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1 from public.import_batches b
    where b.id = source_record_versions.import_batch_id
      and b.created_by = auth.uid()
  )
);

create policy source_record_version_raw_rows_audit
on public.source_record_version_raw_rows
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1
    from public.source_record_versions v
    join public.import_batches b on b.id = v.import_batch_id
    where v.id = source_record_version_raw_rows.source_record_version_id
      and b.created_by = auth.uid()
  )
);

create policy rule_versions_audit
on public.rule_versions
for select to authenticated
using (public.has_capability(auth.uid(), 'import.audit'));

create policy validation_runs_view_own_batch
on public.validation_runs
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.view')
  and exists (
    select 1 from public.import_batches b
    where b.id = validation_runs.import_batch_id
      and b.created_by = auth.uid()
  )
);

create policy validation_run_rule_versions_audit
on public.validation_run_rule_versions
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1
    from public.validation_runs r
    join public.import_batches b on b.id = r.import_batch_id
    where r.id = validation_run_rule_versions.validation_run_id
      and b.created_by = auth.uid()
  )
);

create policy data_quality_issues_view_own_batch
on public.data_quality_issues
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.view')
  and exists (
    select 1
    from public.validation_runs r
    join public.import_batches b on b.id = r.import_batch_id
    where r.id = data_quality_issues.validation_run_id
      and b.created_by = auth.uid()
  )
);

create policy publication_snapshots_view
on public.publication_snapshots
for select to authenticated
using (public.has_capability(auth.uid(), 'import.view'));

create policy publication_snapshot_items_audit
on public.publication_snapshot_items
for select to authenticated
using (public.has_capability(auth.uid(), 'import.audit'));

create policy import_state_events_audit_own_batch
on public.import_state_events
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1 from public.import_batches b
    where b.id = import_state_events.import_batch_id
      and b.created_by = auth.uid()
  )
);

create policy import_request_idempotency_self
on public.import_request_idempotency
for select to authenticated
using (
  actor_id = auth.uid()
  and public.has_capability(auth.uid(), 'import.audit')
);
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
-- Package 01: imported source bytes are private infrastructure evidence.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'source-imports',
  'source-imports',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No authenticated or anon storage.objects policy is installed.  The backend alone
-- creates narrowly-scoped, short-lived signed upload/download URLs after capability
-- and batch ownership checks; originals are never used as storage object paths.
revoke all on table storage.objects from anon, authenticated;
-- Package 02: customer master canonical dimensions.  This is a single-dealer
-- model; tenant or dealer selectors are intentionally not introduced.

create type public.customer_master_status as enum (
  'ACTIVE', 'PASSIVE', 'CANCELLED', 'UNKNOWN', 'NOT_PRESENT_IN_CURRENT_MASTER'
);
create type public.customer_resolution_state as enum (
  'RESOLVED', 'PARTIAL', 'UNRESOLVED', 'REVIEW_REQUIRED', 'UNASSIGNED'
);
create type public.customer_channel as enum ('OPEN', 'CLOSED', 'UNCLASSIFIED');
create type public.organization_person_kind as enum ('SALES_REP', 'DIST_SALES_CHIEF');
create type public.customer_master_snapshot_status as enum (
  'STAGED', 'PUBLISHED', 'PUBLISHED_WITH_EXCEPTIONS', 'BACKDATED_MASTER_REVIEW'
);

create table public.customers (
  customer_id uuid primary key default gen_random_uuid(),
  customer_code text not null unique check (customer_code ~ '^500[0-9]+$'),
  created_from_import_batch_id uuid references public.import_batches(id),
  created_at timestamptz not null default now()
);

create table public.customer_master_snapshots (
  id uuid primary key default gen_random_uuid(),
  publication_snapshot_id uuid unique references public.publication_snapshots(id),
  import_batch_id uuid not null unique references public.import_batches(id),
  source_contract_version_id uuid not null references public.source_contract_versions(id),
  scope_key text not null check (btrim(scope_key) <> ''),
  business_effective_at timestamptz not null,
  effective_at_provenance text not null check (effective_at_provenance in ('SOURCE_CUTOVER', 'UPLOAD_TIME_FALLBACK')),
  status public.customer_master_snapshot_status not null default 'STAGED',
  is_current boolean not null default false,
  previous_snapshot_id uuid references public.customer_master_snapshots(id),
  control_totals jsonb not null default '{}'::jsonb check (jsonb_typeof(control_totals) = 'object'),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  check ((status in ('PUBLISHED', 'PUBLISHED_WITH_EXCEPTIONS') and published_at is not null)
    or (status not in ('PUBLISHED', 'PUBLISHED_WITH_EXCEPTIONS')))
);
create unique index customer_master_snapshots_one_current_scope_idx
  on public.customer_master_snapshots (scope_key) where is_current;

create table public.customer_master_row_observations (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  source_record_version_id uuid not null unique references public.source_record_versions(id),
  raw_source_row_id uuid not null unique references public.raw_source_rows(id),
  sheet_name text not null check (btrim(sheet_name) <> ''),
  source_row_number integer not null check (source_row_number > 0),
  customer_code_candidate text,
  customer_code_valid boolean not null default false,
  parsed_payload jsonb not null check (jsonb_typeof(parsed_payload) = 'object'),
  parser_warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(parser_warnings) = 'array'),
  created_at timestamptz not null default now(),
  unique (import_batch_id, sheet_name, source_row_number)
);

create table public.customer_snapshot_memberships (
  customer_master_snapshot_id uuid not null references public.customer_master_snapshots(id),
  customer_id uuid not null references public.customers(customer_id),
  source_observation_count integer not null check (source_observation_count > 0),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  primary key (customer_master_snapshot_id, customer_id)
);

create table public.customer_profile_versions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id),
  customer_master_snapshot_id uuid not null references public.customer_master_snapshots(id),
  valid_from timestamptz not null,
  valid_to timestamptz,
  resolution_state public.customer_resolution_state not null,
  profile_data jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_data) = 'object'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table public.customer_status_versions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id),
  customer_master_snapshot_id uuid references public.customer_master_snapshots(id),
  valid_from timestamptz not null,
  valid_to timestamptz,
  status public.customer_master_status not null,
  resolution_state public.customer_resolution_state not null,
  raw_status_distribution jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_status_distribution) = 'object'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table public.customer_status_aliases (
  id uuid primary key default gen_random_uuid(),
  raw_normalized text not null,
  canonical_status public.customer_master_status not null check (canonical_status <> 'NOT_PRESENT_IN_CURRENT_MASTER'),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  is_approved boolean not null default true,
  unique (raw_normalized, valid_from),
  check (valid_to is null or valid_to > valid_from)
);

create table public.channel_definitions (
  id uuid primary key default gen_random_uuid(),
  channel public.customer_channel not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);
create table public.channel_aliases (
  id uuid primary key default gen_random_uuid(),
  raw_normalized text not null,
  channel_id uuid not null references public.channel_definitions(id),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  is_approved boolean not null default true,
  unique (raw_normalized, valid_from),
  check (valid_to is null or valid_to > valid_from)
);
create table public.customer_channel_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id),
  customer_master_snapshot_id uuid not null references public.customer_master_snapshots(id),
  channel_id uuid not null references public.channel_definitions(id),
  valid_from timestamptz not null,
  valid_to timestamptz,
  resolution_state public.customer_resolution_state not null,
  source_values jsonb not null default '[]'::jsonb check (jsonb_typeof(source_values) = 'array'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table public.segment_definitions (
  id uuid primary key default gen_random_uuid(),
  segment_code text not null unique,
  display_name text not null,
  is_unclassified boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.segment_aliases (
  id uuid primary key default gen_random_uuid(),
  raw_normalized text not null,
  segment_id uuid not null references public.segment_definitions(id),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  is_approved boolean not null default true,
  unique (raw_normalized, valid_from),
  check (valid_to is null or valid_to > valid_from)
);
create table public.customer_segment_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id),
  customer_master_snapshot_id uuid not null references public.customer_master_snapshots(id),
  segment_id uuid not null references public.segment_definitions(id),
  valid_from timestamptz not null,
  valid_to timestamptz,
  resolution_state public.customer_resolution_state not null,
  source_values jsonb not null default '[]'::jsonb check (jsonb_typeof(source_values) = 'array'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table public.organization_people (
  id uuid primary key default gen_random_uuid(),
  person_kind public.organization_person_kind not null,
  display_name text not null check (btrim(display_name) <> ''),
  normalized_name text not null check (btrim(normalized_name) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (person_kind, normalized_name)
);
create table public.organization_person_aliases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.organization_people(id),
  person_kind public.organization_person_kind not null,
  raw_name text not null check (btrim(raw_name) <> ''),
  raw_normalized text not null check (btrim(raw_normalized) <> ''),
  valid_from timestamptz not null,
  valid_to timestamptz,
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);
create table public.customer_rep_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id),
  customer_master_snapshot_id uuid not null references public.customer_master_snapshots(id),
  rep_person_id uuid references public.organization_people(id),
  valid_from timestamptz not null,
  valid_to timestamptz,
  resolution_state public.customer_resolution_state not null,
  source_candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(source_candidates) = 'array'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check ((rep_person_id is not null) = (resolution_state = 'RESOLVED')),
  check (valid_to is null or valid_to > valid_from)
);
create table public.rep_ssm_assignments (
  id uuid primary key default gen_random_uuid(),
  rep_person_id uuid not null references public.organization_people(id),
  customer_master_snapshot_id uuid not null references public.customer_master_snapshots(id),
  ssm_person_id uuid references public.organization_people(id),
  valid_from timestamptz not null,
  valid_to timestamptz,
  resolution_state public.customer_resolution_state not null,
  dominant_numerator integer not null default 0 check (dominant_numerator >= 0),
  dominant_denominator integer not null default 0 check (dominant_denominator >= 0),
  dominant_ratio numeric(8,6),
  decision_reason text not null check (btrim(decision_reason) <> ''),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check (dominant_numerator <= dominant_denominator),
  check ((dominant_denominator = 0 and dominant_ratio is null) or (dominant_denominator > 0 and dominant_ratio is not null)),
  check ((ssm_person_id is not null) = (resolution_state = 'RESOLVED')),
  check (valid_to is null or valid_to > valid_from)
);

create table public.hierarchy_resolution_issues (
  id uuid primary key default gen_random_uuid(),
  customer_master_snapshot_id uuid not null references public.customer_master_snapshots(id),
  customer_id uuid references public.customers(customer_id),
  rep_person_id uuid references public.organization_people(id),
  issue_code text not null check (btrim(issue_code) <> ''),
  state text not null default 'OPEN' check (state in ('OPEN', 'RESOLVED', 'WAIVED')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);
create table public.master_resolution_runs (
  id uuid primary key default gen_random_uuid(),
  customer_master_snapshot_id uuid not null unique references public.customer_master_snapshots(id),
  rule_version text not null check (btrim(rule_version) <> ''),
  status text not null check (status in ('RUNNING', 'SUCCEEDED', 'SUCCEEDED_WITH_EXCEPTIONS', 'FAILED')),
  counts jsonb not null default '{}'::jsonb check (jsonb_typeof(counts) = 'object'),
  coverage jsonb not null default '{}'::jsonb check (jsonb_typeof(coverage) = 'object'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid not null references auth.users(id)
);

insert into public.channel_definitions (channel, display_name) values
  ('OPEN', 'AÃ§Ä±k'), ('CLOSED', 'KapalÄ±'), ('UNCLASSIFIED', 'SÄ±nÄ±flandÄ±rÄ±lmamÄ±ÅŸ')
on conflict (channel) do nothing;
insert into public.segment_definitions (segment_code, display_name, is_unclassified)
values ('UNCLASSIFIED_SEGMENT', 'SÄ±nÄ±flandÄ±rÄ±lmamÄ±ÅŸ segment', true)
on conflict (segment_code) do nothing;
insert into public.customer_status_aliases (raw_normalized, canonical_status, valid_from) values
  ('aktif', 'ACTIVE', '2000-01-01T00:00:00Z'), ('aktif (a)', 'ACTIVE', '2000-01-01T00:00:00Z'),
  ('active', 'ACTIVE', '2000-01-01T00:00:00Z'),
  ('pasif', 'PASSIVE', '2000-01-01T00:00:00Z'), ('pasif (p)', 'PASSIVE', '2000-01-01T00:00:00Z'),
  ('passive', 'PASSIVE', '2000-01-01T00:00:00Z'),
  ('iptal', 'CANCELLED', '2000-01-01T00:00:00Z'), ('iptal (c)', 'CANCELLED', '2000-01-01T00:00:00Z'),
  ('iptal edildi', 'CANCELLED', '2000-01-01T00:00:00Z'),
  ('cancelled', 'CANCELLED', '2000-01-01T00:00:00Z')
on conflict (raw_normalized, valid_from) do nothing;
insert into public.channel_aliases (raw_normalized, channel_id, valid_from)
select v.raw_normalized, d.id, '2000-01-01T00:00:00Z'::timestamptz
from (values
  ('standart aÃ§Ä±k', 'OPEN'::public.customer_channel), ('horeca', 'OPEN'::public.customer_channel),
  ('otel', 'OPEN'::public.customer_channel), ('standart kapalÄ±', 'CLOSED'::public.customer_channel),
  ('ekomini', 'CLOSED'::public.customer_channel)
) as v(raw_normalized, channel)
join public.channel_definitions d on d.channel = v.channel
on conflict (raw_normalized, valid_from) do nothing;

insert into public.source_contract_versions (
  source_kind, contract_version, header_signature, required_fields, parser_name, parser_version,
  effective_from, status, publication_mode, empty_snapshot_allowed
) values (
  'CUSTOMER_MASTER', 1,
  'MÃ¼ÅŸteri|MÃ¼ÅŸteri AdÄ±|Tabela AdÄ±|SatÄ±ÅŸ Temsilcisi AdÄ±|Dist SatÄ±ÅŸ Åefi AdÄ±|SatÄ±ÅŸ KanalÄ± TanÄ±mÄ±|MÃ¼ÅŸteri Hacim Segmenti|MÃ¼ÅŸteri Durumu',
  '["MÃ¼ÅŸteri","MÃ¼ÅŸteri AdÄ±","Tabela AdÄ±","SatÄ±ÅŸ Temsilcisi AdÄ±","Dist SatÄ±ÅŸ Åefi AdÄ±","SatÄ±ÅŸ KanalÄ± TanÄ±mÄ±","MÃ¼ÅŸteri Hacim Segmenti","MÃ¼ÅŸteri Durumu"]'::jsonb,
  'customer-master-v2', '2.0.0', now(), 'ACTIVE', 'FULL_REPLACE', false
)
on conflict (source_kind, contract_version) do nothing;

create index customer_master_observations_batch_idx on public.customer_master_row_observations (import_batch_id, customer_code_candidate);
create index customer_master_memberships_customer_idx on public.customer_snapshot_memberships (customer_id);
create index customer_profile_versions_customer_idx on public.customer_profile_versions (customer_id, valid_from desc);
create index customer_status_versions_customer_idx on public.customer_status_versions (customer_id, valid_from desc);
create index customer_channel_assignments_customer_idx on public.customer_channel_assignments (customer_id, valid_from desc);
create index customer_segment_assignments_customer_idx on public.customer_segment_assignments (customer_id, valid_from desc);
create index customer_rep_assignments_customer_idx on public.customer_rep_assignments (customer_id, valid_from desc);
create index rep_ssm_assignments_rep_idx on public.rep_ssm_assignments (rep_person_id, valid_from desc);
-- Package 02: temporal integrity and append-only provenance.

alter table public.customer_profile_versions
  add constraint customer_profile_versions_no_overlap
  exclude using gist (customer_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.customer_status_versions
  add constraint customer_status_versions_no_overlap
  exclude using gist (customer_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.customer_channel_assignments
  add constraint customer_channel_assignments_no_overlap
  exclude using gist (customer_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.customer_segment_assignments
  add constraint customer_segment_assignments_no_overlap
  exclude using gist (customer_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.customer_rep_assignments
  add constraint customer_rep_assignments_no_overlap
  exclude using gist (customer_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.rep_ssm_assignments
  add constraint rep_ssm_assignments_no_overlap
  exclude using gist (rep_person_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.organization_person_aliases
  add constraint organization_person_aliases_no_overlap
  exclude using gist (person_kind with =, raw_normalized with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.customer_status_aliases
  add constraint customer_status_aliases_no_overlap
  exclude using gist (raw_normalized with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.channel_aliases
  add constraint channel_aliases_no_overlap
  exclude using gist (raw_normalized with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.segment_aliases
  add constraint segment_aliases_no_overlap
  exclude using gist (raw_normalized with =, tstzrange(valid_from, valid_to, '[)') with &&);

create or replace function public.customer_master_forbid_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.customer_master_publish', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'CUSTOMER_MASTER_HISTORY_IMMUTABLE' using errcode = '55000';
end;
$$;

create or replace function public.customer_master_payload_is_safe(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_payload) = 'object'
    and not (p_payload ?| array[
      'creditLimit', 'credit_limit', 'krediLimiti', 'kredi_limiti',
      'chequeNoteRiskRatio', 'cekSenetRiskOrani', 'Ã§ekSenetRiskOranÄ±'
    ]);
$$;

alter table public.customer_master_row_observations
  add constraint customer_master_observations_no_financial_payload
  check (public.customer_master_payload_is_safe(parsed_payload));

create trigger customer_master_observations_immutable
before update or delete on public.customer_master_row_observations
for each row execute function public.customer_master_forbid_history_mutation();
create trigger customer_master_memberships_immutable
before update or delete on public.customer_snapshot_memberships
for each row execute function public.customer_master_forbid_history_mutation();
create trigger customer_profile_versions_immutable
before update or delete on public.customer_profile_versions
for each row execute function public.customer_master_forbid_history_mutation();
create trigger customer_status_versions_immutable
before update or delete on public.customer_status_versions
for each row execute function public.customer_master_forbid_history_mutation();
create trigger customer_channel_assignments_immutable
before update or delete on public.customer_channel_assignments
for each row execute function public.customer_master_forbid_history_mutation();
create trigger customer_segment_assignments_immutable
before update or delete on public.customer_segment_assignments
for each row execute function public.customer_master_forbid_history_mutation();
create trigger customer_rep_assignments_immutable
before update or delete on public.customer_rep_assignments
for each row execute function public.customer_master_forbid_history_mutation();
create trigger rep_ssm_assignments_immutable
before update or delete on public.rep_ssm_assignments
for each row execute function public.customer_master_forbid_history_mutation();
create trigger customer_master_snapshots_immutable
before update or delete on public.customer_master_snapshots
for each row execute function public.customer_master_forbid_history_mutation();

revoke all on function public.customer_master_forbid_history_mutation() from public, anon;
revoke all on function public.customer_master_payload_is_safe(jsonb) from public, anon;
-- Package 02: fail-closed access controls and non-sensitive read models.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'customers', 'customer_master_snapshots', 'customer_master_row_observations',
    'customer_snapshot_memberships', 'customer_profile_versions', 'customer_status_versions',
    'customer_status_aliases', 'channel_definitions', 'channel_aliases',
    'customer_channel_assignments', 'segment_definitions', 'segment_aliases',
    'customer_segment_assignments', 'organization_people', 'organization_person_aliases',
    'customer_rep_assignments', 'rep_ssm_assignments', 'hierarchy_resolution_issues',
    'master_resolution_runs'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

grant select on public.customers, public.customer_master_snapshots,
  public.customer_snapshot_memberships, public.customer_status_versions,
  public.channel_definitions, public.customer_channel_assignments,
  public.segment_definitions, public.customer_segment_assignments
to authenticated;
grant select on public.organization_people, public.customer_rep_assignments,
  public.rep_ssm_assignments, public.hierarchy_resolution_issues,
  public.master_resolution_runs
to authenticated;

create policy customers_view on public.customers for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));
create policy customer_master_snapshots_view on public.customer_master_snapshots for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));
create policy customer_snapshot_memberships_view on public.customer_snapshot_memberships for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));
create policy customer_status_versions_view on public.customer_status_versions for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));
create policy channel_definitions_view on public.channel_definitions for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));
create policy customer_channel_assignments_view on public.customer_channel_assignments for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));
create policy segment_definitions_view on public.segment_definitions for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));
create policy customer_segment_assignments_view on public.customer_segment_assignments for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));
create policy organization_people_view on public.organization_people for select to authenticated
using (public.has_capability(auth.uid(), 'organization.view'));
create policy customer_rep_assignments_view on public.customer_rep_assignments for select to authenticated
using (public.has_capability(auth.uid(), 'organization.view'));
create policy rep_ssm_assignments_view on public.rep_ssm_assignments for select to authenticated
using (public.has_capability(auth.uid(), 'organization.view'));
create policy hierarchy_resolution_issues_view on public.hierarchy_resolution_issues for select to authenticated
using (public.has_capability(auth.uid(), 'organization.view'));
create policy master_resolution_runs_view on public.master_resolution_runs for select to authenticated
using (public.has_capability(auth.uid(), 'customer.view'));

create policy customer_profile_versions_audit on public.customer_profile_versions for select to authenticated
using (public.has_capability(auth.uid(), 'customer.audit') and public.has_capability(auth.uid(), 'import.audit'));
create policy customer_master_observations_audit on public.customer_master_row_observations for select to authenticated
using (public.has_capability(auth.uid(), 'customer.audit') and public.has_capability(auth.uid(), 'import.audit'));
create policy customer_status_aliases_audit on public.customer_status_aliases for select to authenticated
using (public.has_capability(auth.uid(), 'customer.audit'));
create policy channel_aliases_audit on public.channel_aliases for select to authenticated
using (public.has_capability(auth.uid(), 'customer.audit'));
create policy segment_aliases_audit on public.segment_aliases for select to authenticated
using (public.has_capability(auth.uid(), 'customer.audit'));
create policy organization_person_aliases_audit on public.organization_person_aliases for select to authenticated
using (public.has_capability(auth.uid(), 'customer.audit'));

create or replace view public.customer_master_current_public_v2
with (security_invoker = true)
as
select
  c.customer_id,
  c.customer_code,
  st.status,
  st.resolution_state as status_resolution_state,
  cd.channel,
  ca.resolution_state as channel_resolution_state,
  sd.segment_code,
  sd.display_name as segment_display_name,
  sa.resolution_state as segment_resolution_state,
  rep.id as rep_person_id,
  rep.display_name as rep_display_name,
  cra.resolution_state as rep_resolution_state,
  ssm.id as ssm_person_id,
  ssm.display_name as ssm_display_name,
  rsa.resolution_state as ssm_resolution_state
from public.customers c
left join lateral (
  select * from public.customer_status_versions v
  where v.customer_id = c.customer_id and v.valid_from <= now()
    and (v.valid_to is null or v.valid_to > now())
  order by v.valid_from desc limit 1
) st on true
left join lateral (
  select * from public.customer_channel_assignments v
  where v.customer_id = c.customer_id and v.valid_from <= now()
    and (v.valid_to is null or v.valid_to > now())
  order by v.valid_from desc limit 1
) ca on true
left join public.channel_definitions cd on cd.id = ca.channel_id
left join lateral (
  select * from public.customer_segment_assignments v
  where v.customer_id = c.customer_id and v.valid_from <= now()
    and (v.valid_to is null or v.valid_to > now())
  order by v.valid_from desc limit 1
) sa on true
left join public.segment_definitions sd on sd.id = sa.segment_id
left join lateral (
  select * from public.customer_rep_assignments v
  where v.customer_id = c.customer_id and v.valid_from <= now()
    and (v.valid_to is null or v.valid_to > now())
  order by v.valid_from desc limit 1
) cra on true
left join public.organization_people rep on rep.id = cra.rep_person_id
left join lateral (
  select * from public.rep_ssm_assignments v
  where v.rep_person_id = cra.rep_person_id and v.valid_from <= now()
    and (v.valid_to is null or v.valid_to > now())
  order by v.valid_from desc limit 1
) rsa on true
left join public.organization_people ssm on ssm.id = rsa.ssm_person_id;

grant select on public.customer_master_current_public_v2 to authenticated;
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
    jsonb_build_object('customerCodeCandidate', customer_code_candidate), 'MÃ¼ÅŸteri',
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
-- Package 03: product identity and evidence dimensions.  No stock or sales metric
-- is created here; product codes remain immutable source text.

create type public.product_resolution_state as enum (
  'RESOLVED', 'PARTIAL', 'UNRESOLVED', 'REVIEW_REQUIRED', 'BLOCKED'
);
create type public.product_evidence_kind as enum (
  'SELLOUT', 'KA', 'PACKAGE_PROPAGATED', 'CATALOG', 'MANUAL', 'NAME_CANDIDATE'
);
create type public.product_resolution_run_status as enum (
  'RUNNING', 'SUCCEEDED', 'SUCCEEDED_WITH_EXCEPTIONS', 'FAILED'
);

create table public.product_variants (
  product_variant_id uuid primary key default gen_random_uuid(),
  material_code text not null unique check (btrim(material_code) <> ''),
  volume_tracked boolean,
  created_from_import_batch_id uuid references public.import_batches(id),
  created_at timestamptz not null default now()
);

create table public.product_variant_names (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(product_variant_id),
  source_name text not null check (btrim(source_name) <> ''),
  normalized_name text not null check (btrim(normalized_name) <> ''),
  source_kind text not null check (btrim(source_kind) <> ''),
  source_version text not null check (btrim(source_version) <> ''),
  valid_from timestamptz not null,
  valid_to timestamptz,
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table public.product_families (
  product_family_id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE', 'RETIRED', 'MERGED', 'SPLIT_REVIEW')),
  creation_reason text not null check (btrim(creation_reason) <> ''),
  created_at timestamptz not null default now()
);

create table public.product_family_membership_versions (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(product_variant_id),
  product_family_id uuid not null references public.product_families(product_family_id),
  valid_from timestamptz not null,
  valid_to timestamptz,
  resolution_state public.product_resolution_state not null,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  decision_source public.product_evidence_kind not null,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table public.product_family_policy_versions (
  id uuid primary key default gen_random_uuid(),
  product_family_id uuid not null references public.product_families(product_family_id),
  canonical_stock_variant_id uuid references public.product_variants(product_variant_id),
  replenishment_variant_id uuid references public.product_variants(product_variant_id),
  valid_from timestamptz not null,
  valid_to timestamptz,
  decision_reason text not null check (btrim(decision_reason) <> ''),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table public.package_conversion_observations (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  source_record_version_id uuid not null unique references public.source_record_versions(id),
  raw_source_row_id uuid not null unique references public.raw_source_rows(id),
  sheet_name text not null check (btrim(sheet_name) <> ''),
  source_row_number integer not null check (source_row_number > 0),
  operation_date date,
  source_material_code text,
  source_quantity numeric(30,12),
  target_material_code text,
  target_quantity numeric(30,12),
  source_document_reference text,
  parser_warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(parser_warnings) = 'array'),
  natural_key_hash char(64) not null check (natural_key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (import_batch_id, sheet_name, source_row_number),
  check (source_quantity is null or source_quantity > 0),
  check (target_quantity is null or target_quantity > 0)
);

create table public.package_conversion_edge_versions (
  id uuid primary key default gen_random_uuid(),
  source_product_variant_id uuid not null references public.product_variants(product_variant_id),
  target_product_variant_id uuid not null references public.product_variants(product_variant_id),
  target_units_per_source_unit numeric(30,12) not null check (target_units_per_source_unit > 0),
  valid_from timestamptz not null,
  valid_to timestamptz,
  evidence_count integer not null check (evidence_count > 0),
  resolution_state public.product_resolution_state not null,
  rule_version text not null check (btrim(rule_version) <> ''),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check (source_product_variant_id <> target_product_variant_id),
  check (valid_to is null or valid_to > valid_from)
);

create table public.product_measurement_evidence (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(product_variant_id),
  evidence_kind public.product_evidence_kind not null check (evidence_kind in ('SELLOUT', 'KA')),
  source_batch_id uuid references public.import_batches(id),
  observed_from timestamptz not null,
  observed_to timestamptz not null,
  positive_row_count integer not null check (positive_row_count > 0),
  sum_quantity numeric(30,12) not null check (sum_quantity > 0),
  sum_litres numeric(30,12) not null check (sum_litres > 0),
  source_decimal_scale integer not null default 6 check (source_decimal_scale between 0 and 12),
  dispersion jsonb not null default '{}'::jsonb check (jsonb_typeof(dispersion) = 'object'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  check (observed_to >= observed_from)
);

create table public.product_litre_candidates (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(product_variant_id),
  candidate_kind public.product_evidence_kind not null,
  litres_per_stock_unit numeric(20,6) not null check (litres_per_stock_unit > 0),
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW')),
  verification_status text not null check (verification_status in ('OBSERVED_LOW_EVIDENCE', 'VERIFIED', 'CONFLICT', 'UNIT_INCONSISTENT', 'MANUAL_APPROVED')),
  source_path jsonb not null default '[]'::jsonb check (jsonb_typeof(source_path) = 'array'),
  created_at timestamptz not null default now()
);

create table public.product_litre_versions (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(product_variant_id),
  litres_per_stock_unit numeric(20,6),
  quantity_uom text,
  units_per_case numeric(20,6),
  unit_volume_ml numeric(20,6),
  volume_tracked boolean not null default true,
  valid_from timestamptz not null,
  valid_to timestamptz,
  selection_reason text not null check (btrim(selection_reason) <> ''),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  created_at timestamptz not null default now(),
  check ((volume_tracked and litres_per_stock_unit is not null and litres_per_stock_unit > 0)
      or (not volume_tracked and litres_per_stock_unit is null)),
  check (valid_to is null or valid_to > valid_from)
);

create table public.product_resolution_runs (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid references public.import_batches(id),
  rule_version text not null check (btrim(rule_version) <> ''),
  status public.product_resolution_run_status not null,
  input_versions jsonb not null default '{}'::jsonb check (jsonb_typeof(input_versions) = 'object'),
  component_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(component_summary) = 'object'),
  coverage jsonb not null default '{}'::jsonb check (jsonb_typeof(coverage) = 'object'),
  result_hash char(64) not null check (result_hash ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references auth.users(id)
);

create table public.product_resolution_issues (
  id uuid primary key default gen_random_uuid(),
  product_resolution_run_id uuid references public.product_resolution_runs(id),
  product_family_id uuid references public.product_families(product_family_id),
  product_variant_id uuid references public.product_variants(product_variant_id),
  issue_code text not null check (btrim(issue_code) <> ''),
  state text not null default 'OPEN' check (state in ('OPEN', 'RESOLVED', 'WAIVED')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create table public.product_manual_resolutions (
  id uuid primary key default gen_random_uuid(),
  product_resolution_issue_id uuid references public.product_resolution_issues(id),
  resolution_kind text not null check (resolution_kind in ('FAMILY_MEMBERSHIP', 'FAMILY_POLICY', 'NON_VOLUME', 'LITRE_OVERRIDE')),
  status text not null check (status in ('PREVIEWED', 'COMMITTED', 'REVERTED')),
  reason text not null check (btrim(reason) <> ''),
  previous_value jsonb not null default '{}'::jsonb check (jsonb_typeof(previous_value) = 'object'),
  new_value jsonb not null default '{}'::jsonb check (jsonb_typeof(new_value) = 'object'),
  impact_preview jsonb not null default '{}'::jsonb check (jsonb_typeof(impact_preview) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  reverted_at timestamptz,
  reverted_by uuid references auth.users(id),
  revert_reason text check (revert_reason is null or btrim(revert_reason) <> '')
);

insert into public.source_contract_versions (
  source_kind, contract_version, header_signature, required_fields, parser_name, parser_version,
  effective_from, status, publication_mode, empty_snapshot_allowed
) values (
  'PACKAGE_CONVERSION_HISTORY', 1,
  'Ä°ÅŸlem Tarihi|Bozulan/BirleÅŸtirilen ÃœrÃ¼n Kodu|Miktar|OluÅŸan ÃœrÃ¼n Kodu|Miktar',
  '["Ä°ÅŸlem Tarihi","Bozulan/BirleÅŸtirilen ÃœrÃ¼n Kodu","Miktar","OluÅŸan ÃœrÃ¼n Kodu","Miktar"]'::jsonb,
  'package-conversion-v2', '1.0.0', now(), 'ACTIVE', 'UPSERT_VERSIONED', false
)
on conflict (source_kind, contract_version) do nothing;
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
      insert into public.product_families(display_name, creation_reason) values ('ÃœrÃ¼n ailesi ' || v_edge.source_material_code, 'CONSISTENT_PACKAGE_GRAPH') returning product_family_id into v_family;
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
-- Package 03: temporal non-overlap and append-only product history.

alter table public.product_family_membership_versions add constraint product_family_membership_no_overlap
  exclude using gist (product_variant_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.product_family_policy_versions add constraint product_family_policy_no_overlap
  exclude using gist (product_family_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.product_litre_versions add constraint product_litre_no_overlap
  exclude using gist (product_variant_id with =, tstzrange(valid_from, valid_to, '[)') with &&);

create or replace function public.prevent_product_history_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('app.product_resolution_write', true) is distinct from 'on' then
    raise exception 'PRODUCT_HISTORY_IMMUTABLE' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger product_membership_append_only before update or delete on public.product_family_membership_versions
for each row execute function public.prevent_product_history_mutation();
create trigger product_family_policy_append_only before update or delete on public.product_family_policy_versions
for each row execute function public.prevent_product_history_mutation();
create trigger product_litre_append_only before update or delete on public.product_litre_versions
for each row execute function public.prevent_product_history_mutation();
create trigger product_conversion_edges_append_only before update or delete on public.package_conversion_edge_versions
for each row execute function public.prevent_product_history_mutation();

create or replace function public.normalize_product_resolution_proposal_v2(p_proposal jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_kind text; v_valid_from timestamptz; v_key text; v_value text;
begin
  if jsonb_typeof(p_proposal) <> 'object' then raise exception 'INVALID_PRODUCT_RESOLUTION_PROPOSAL' using errcode = '22023'; end if;
  v_kind := p_proposal->>'resolutionKind';
  if v_kind not in ('FAMILY_MEMBERSHIP','FAMILY_POLICY','NON_VOLUME','LITRE_OVERRIDE') then raise exception 'INVALID_PRODUCT_RESOLUTION_KIND' using errcode = '22023'; end if;
  begin v_valid_from := (p_proposal->>'validFrom')::timestamptz; exception when others then raise exception 'INVALID_PRODUCT_RESOLUTION_EFFECTIVE_AT' using errcode = '22023'; end;
  if v_valid_from is null then raise exception 'INVALID_PRODUCT_RESOLUTION_EFFECTIVE_AT' using errcode = '22023'; end if;
  foreach v_key in array (case when v_kind in ('FAMILY_MEMBERSHIP','NON_VOLUME','LITRE_OVERRIDE') then array['productVariantId'] else array['productFamilyId'] end) loop
    v_value := p_proposal->>v_key;
    if v_value is null or not (v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'INVALID_PRODUCT_RESOLUTION_REFERENCE' using errcode = '22023'; end if;
  end loop;
  if v_kind = 'FAMILY_MEMBERSHIP' then
    v_value := p_proposal->>'productFamilyId';
    if v_value is null or not (v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'INVALID_PRODUCT_RESOLUTION_REFERENCE' using errcode = '22023'; end if;
  end if;
  if v_kind = 'FAMILY_POLICY' then
    if coalesce(p_proposal->>'canonicalStockVariantId',p_proposal->>'replenishmentVariantId') is null then raise exception 'PRODUCT_POLICY_VARIANT_REQUIRED' using errcode = '22023'; end if;
    foreach v_key in array array['canonicalStockVariantId','replenishmentVariantId'] loop
      v_value := p_proposal->>v_key;
      if v_value is not null and not (v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'INVALID_PRODUCT_RESOLUTION_REFERENCE' using errcode = '22023'; end if;
    end loop;
  end if;
  if v_kind = 'LITRE_OVERRIDE' then
    v_value := p_proposal->>'litresPerStockUnit';
    if v_value is null or not (v_value ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$') or v_value::numeric <= 0 then raise exception 'INVALID_PRODUCT_LITRE_OVERRIDE' using errcode = '22023'; end if;
    if jsonb_typeof(p_proposal->'evidence') <> 'array' or jsonb_array_length(p_proposal->'evidence') = 0 then raise exception 'PRODUCT_LITRE_EVIDENCE_REQUIRED' using errcode = '22023'; end if;
  end if;
  foreach v_key in array array['unitsPerCase','unitVolumeMl'] loop
    v_value := p_proposal->>v_key;
    if v_value is not null and (not (v_value ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$') or v_value::numeric <= 0) then raise exception 'INVALID_PRODUCT_DIMENSION' using errcode = '22023'; end if;
  end loop;
  if p_proposal ? 'quantityUom' and btrim(coalesce(p_proposal->>'quantityUom','')) = '' then raise exception 'INVALID_PRODUCT_QUANTITY_UOM' using errcode = '22023'; end if;
  return p_proposal || jsonb_build_object('resolutionKind',v_kind,'validFrom',v_valid_from::text);
end;
$$;

create or replace function public.product_resolution_preview_v2(p_issue_id uuid, p_proposal jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_issue public.product_resolution_issues; v_proposal jsonb; v_kind text; v_valid_from timestamptz; v_current jsonb := null;
begin
  perform public.require_product_capability('product.resolve');
  v_proposal := public.normalize_product_resolution_proposal_v2(p_proposal); v_kind := v_proposal->>'resolutionKind'; v_valid_from := (v_proposal->>'validFrom')::timestamptz;
  select * into v_issue from public.product_resolution_issues where id=p_issue_id for update;
  if not found then raise exception 'PRODUCT_RESOLUTION_ISSUE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_kind='FAMILY_MEMBERSHIP' then select to_jsonb(m) into v_current from public.product_family_membership_versions m where m.product_variant_id=(v_proposal->>'productVariantId')::uuid and m.valid_from<=v_valid_from and(m.valid_to is null or m.valid_to>v_valid_from) order by m.valid_from desc limit 1;
  elsif v_kind='FAMILY_POLICY' then select to_jsonb(p) into v_current from public.product_family_policy_versions p where p.product_family_id=(v_proposal->>'productFamilyId')::uuid and p.valid_from<=v_valid_from and(p.valid_to is null or p.valid_to>v_valid_from) order by p.valid_from desc limit 1;
  else select to_jsonb(l) into v_current from public.product_litre_versions l where l.product_variant_id=(v_proposal->>'productVariantId')::uuid and l.valid_from<=v_valid_from and(l.valid_to is null or l.valid_to>v_valid_from) order by l.valid_from desc limit 1;
  end if;
  return jsonb_build_object('issueId',v_issue.id,'issueCode',v_issue.issue_code,'state',v_issue.state,'proposal',v_proposal,'currentValue',v_current,'requiresBackdatedApproval',v_valid_from < transaction_timestamp(),
    'impact',jsonb_build_object('downstreamInvalidations',jsonb_build_array('SELLOUT','FKNS','CURRENT_STOCK','STOCK_PLANNING'),'computedNow',false));
end;
$$;

create or replace function public.commit_product_resolution_v2(p_issue_id uuid, p_proposal jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_issue public.product_resolution_issues; v_resolution public.product_manual_resolutions; v_proposal jsonb; v_kind text; v_valid_from timestamptz;
  v_variant uuid; v_family uuid; v_canonical uuid; v_replenishment uuid; v_new_version uuid; v_previous jsonb := '{}'::jsonb; v_new jsonb;
  v_membership public.product_family_membership_versions; v_policy public.product_family_policy_versions; v_litre public.product_litre_versions; v_valid_to timestamptz;
begin
  perform public.require_product_capability('product.resolve');
  if btrim(coalesce(p_reason,''))='' then raise exception 'INVALID_PRODUCT_RESOLUTION_COMMIT' using errcode='22023'; end if;
  v_proposal := public.normalize_product_resolution_proposal_v2(p_proposal); v_kind := v_proposal->>'resolutionKind'; v_valid_from := (v_proposal->>'validFrom')::timestamptz;
  if v_valid_from < transaction_timestamp() and v_proposal->>'backdatedApproval' is distinct from 'true' then raise exception 'BACKDATED_PRODUCT_RULE_REVIEW' using errcode='22023'; end if;
  select * into v_issue from public.product_resolution_issues where id=p_issue_id for update;
  if not found or v_issue.state <> 'OPEN' then raise exception 'PRODUCT_RESOLUTION_NOT_COMMITTABLE' using errcode='55000'; end if;
  perform set_config('app.product_resolution_write', 'on', true);
  if v_kind='FAMILY_MEMBERSHIP' then
    v_variant := (v_proposal->>'productVariantId')::uuid; v_family := (v_proposal->>'productFamilyId')::uuid;
    if not exists(select 1 from public.product_variants where product_variant_id=v_variant) or not exists(select 1 from public.product_families where product_family_id=v_family) then raise exception 'PRODUCT_RESOLUTION_REFERENCE_NOT_FOUND' using errcode='P0002'; end if;
    select * into v_membership from public.product_family_membership_versions where product_variant_id=v_variant and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from) order by valid_from desc limit 1 for update;
    if v_membership.id is not null and v_membership.product_family_id=v_family then raise exception 'PRODUCT_RESOLUTION_NOOP' using errcode='22023'; end if;
    if v_membership.id is null and exists(select 1 from public.product_family_membership_versions where product_variant_id=v_variant and valid_from>v_valid_from) then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
    v_valid_to := v_membership.valid_to;
    if v_membership.id is not null then
      if v_membership.valid_from=v_valid_from then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
      v_previous:=jsonb_build_object('priorMembership',to_jsonb(v_membership)); update public.product_family_membership_versions set valid_to=v_valid_from where id=v_membership.id;
    end if;
    insert into public.product_family_membership_versions(product_variant_id,product_family_id,valid_from,valid_to,resolution_state,evidence,decision_source)
    values(v_variant,v_family,v_valid_from,v_valid_to,'RESOLVED',jsonb_build_array(jsonb_build_object('kind','MANUAL_APPROVED','issueId',p_issue_id)),'MANUAL') returning id into v_new_version;
    v_new:=jsonb_build_object('versionId',v_new_version,'productVariantId',v_variant,'productFamilyId',v_family);
  elsif v_kind='FAMILY_POLICY' then
    v_family := (v_proposal->>'productFamilyId')::uuid; v_canonical:=nullif(v_proposal->>'canonicalStockVariantId','')::uuid; v_replenishment:=nullif(v_proposal->>'replenishmentVariantId','')::uuid;
    if not exists(select 1 from public.product_families where product_family_id=v_family) then raise exception 'PRODUCT_RESOLUTION_REFERENCE_NOT_FOUND' using errcode='P0002'; end if;
    if v_canonical is not null and not exists(select 1 from public.product_family_membership_versions where product_family_id=v_family and product_variant_id=v_canonical and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from)) then raise exception 'PRODUCT_POLICY_VARIANT_NOT_IN_FAMILY' using errcode='22023'; end if;
    if v_replenishment is not null and not exists(select 1 from public.product_family_membership_versions where product_family_id=v_family and product_variant_id=v_replenishment and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from)) then raise exception 'PRODUCT_POLICY_VARIANT_NOT_IN_FAMILY' using errcode='22023'; end if;
    select * into v_policy from public.product_family_policy_versions where product_family_id=v_family and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from) order by valid_from desc limit 1 for update;
    if v_policy.id is not null and v_policy.canonical_stock_variant_id is not distinct from v_canonical and v_policy.replenishment_variant_id is not distinct from v_replenishment then raise exception 'PRODUCT_RESOLUTION_NOOP' using errcode='22023'; end if;
    if v_policy.id is null and exists(select 1 from public.product_family_policy_versions where product_family_id=v_family and valid_from>v_valid_from) then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
    v_valid_to:=v_policy.valid_to;
    if v_policy.id is not null then
      if v_policy.valid_from=v_valid_from then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
      v_previous:=jsonb_build_object('priorPolicy',to_jsonb(v_policy)); update public.product_family_policy_versions set valid_to=v_valid_from where id=v_policy.id;
    end if;
    insert into public.product_family_policy_versions(product_family_id,canonical_stock_variant_id,replenishment_variant_id,valid_from,valid_to,decision_reason)
    values(v_family,v_canonical,v_replenishment,v_valid_from,v_valid_to,'MANUAL_APPROVED: '||p_reason) returning id into v_new_version;
    v_new:=jsonb_build_object('versionId',v_new_version,'productFamilyId',v_family,'canonicalStockVariantId',v_canonical,'replenishmentVariantId',v_replenishment);
  else
    v_variant:=(v_proposal->>'productVariantId')::uuid;
    if not exists(select 1 from public.product_variants where product_variant_id=v_variant) then raise exception 'PRODUCT_RESOLUTION_REFERENCE_NOT_FOUND' using errcode='P0002'; end if;
    select * into v_litre from public.product_litre_versions where product_variant_id=v_variant and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from) order by valid_from desc limit 1 for update;
    if v_litre.id is null and exists(select 1 from public.product_litre_versions where product_variant_id=v_variant and valid_from>v_valid_from) then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
    v_valid_to:=v_litre.valid_to;
    if v_litre.id is not null then
      if v_litre.valid_from=v_valid_from then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
      v_previous:=jsonb_build_object('priorLitre',to_jsonb(v_litre)); update public.product_litre_versions set valid_to=v_valid_from where id=v_litre.id;
    end if;
    if v_kind='NON_VOLUME' then
      insert into public.product_litre_versions(product_variant_id,volume_tracked,valid_from,valid_to,selection_reason,evidence)
      values(v_variant,false,v_valid_from,v_valid_to,'MANUAL_NON_VOLUME: '||p_reason,jsonb_build_array(jsonb_build_object('kind','MANUAL_APPROVED','issueId',p_issue_id))) returning id into v_new_version;
      v_new:=jsonb_build_object('versionId',v_new_version,'productVariantId',v_variant,'volumeTracked',false);
    else
      insert into public.product_litre_versions(product_variant_id,litres_per_stock_unit,quantity_uom,units_per_case,unit_volume_ml,volume_tracked,valid_from,valid_to,selection_reason,evidence)
      values(v_variant,(v_proposal->>'litresPerStockUnit')::numeric,nullif(v_proposal->>'quantityUom',''),nullif(v_proposal->>'unitsPerCase','')::numeric,nullif(v_proposal->>'unitVolumeMl','')::numeric,true,v_valid_from,v_valid_to,'MANUAL_LITRE_OVERRIDE: '||p_reason,v_proposal->'evidence') returning id into v_new_version;
      v_new:=jsonb_build_object('versionId',v_new_version,'productVariantId',v_variant,'litresPerStockUnit',v_proposal->>'litresPerStockUnit');
    end if;
  end if;
  insert into public.product_manual_resolutions(product_resolution_issue_id,resolution_kind,status,reason,previous_value,new_value,impact_preview,created_by,committed_at)
  values(p_issue_id,v_kind,'COMMITTED',p_reason,v_previous,v_new,jsonb_build_object('downstreamInvalidations',jsonb_build_array('SELLOUT','FKNS','CURRENT_STOCK','STOCK_PLANNING'),'computedNow',false),auth.uid(),now()) returning * into v_resolution;
  update public.product_resolution_issues set state='RESOLVED',resolved_at=now(),resolved_by=auth.uid() where id=p_issue_id;
  return jsonb_build_object('resolutionId',v_resolution.id,'status',v_resolution.status,'issueId',p_issue_id,'restatementCandidate',true,'appliedVersionId',v_new_version);
end;
$$;

create or replace function public.revert_product_resolution_v2(p_resolution_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_resolution public.product_manual_resolutions; v_kind text; v_new_version uuid; v_prior jsonb; v_now timestamptz:=transaction_timestamp();
  v_membership public.product_family_membership_versions; v_policy public.product_family_policy_versions; v_litre public.product_litre_versions;
begin
  perform public.require_product_capability('product.resolve');
  if btrim(coalesce(p_reason,''))='' then raise exception 'PRODUCT_RESOLUTION_REVERT_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_resolution from public.product_manual_resolutions where id=p_resolution_id for update;
  if not found or v_resolution.status <> 'COMMITTED' then raise exception 'PRODUCT_RESOLUTION_NOT_REVERTIBLE' using errcode='55000'; end if;
  v_kind:=v_resolution.resolution_kind; v_new_version:=(v_resolution.new_value->>'versionId')::uuid;
  perform set_config('app.product_resolution_write', 'on', true);
  if v_kind='FAMILY_MEMBERSHIP' then
    select * into v_membership from public.product_family_membership_versions where id=v_new_version and valid_to is null for update;
    if not found or v_membership.valid_from>=v_now then raise exception 'PRODUCT_RESOLUTION_REVERT_CONFLICT' using errcode='55000'; end if;
    update public.product_family_membership_versions set valid_to=v_now where id=v_membership.id; v_prior:=v_resolution.previous_value->'priorMembership';
    if v_prior is not null then insert into public.product_family_membership_versions(product_variant_id,product_family_id,valid_from,resolution_state,evidence,decision_source)
      values((v_prior->>'product_variant_id')::uuid,(v_prior->>'product_family_id')::uuid,v_now,(v_prior->>'resolution_state')::public.product_resolution_state,v_prior->'evidence',(v_prior->>'decision_source')::public.product_evidence_kind); end if;
  elsif v_kind='FAMILY_POLICY' then
    select * into v_policy from public.product_family_policy_versions where id=v_new_version and valid_to is null for update;
    if not found or v_policy.valid_from>=v_now then raise exception 'PRODUCT_RESOLUTION_REVERT_CONFLICT' using errcode='55000'; end if;
    update public.product_family_policy_versions set valid_to=v_now where id=v_policy.id; v_prior:=v_resolution.previous_value->'priorPolicy';
    if v_prior is not null then insert into public.product_family_policy_versions(product_family_id,canonical_stock_variant_id,replenishment_variant_id,valid_from,decision_reason)
      values((v_prior->>'product_family_id')::uuid,nullif(v_prior->>'canonical_stock_variant_id','')::uuid,nullif(v_prior->>'replenishment_variant_id','')::uuid,v_now,v_prior->>'decision_reason'); end if;
  else
    select * into v_litre from public.product_litre_versions where id=v_new_version and valid_to is null for update;
    if not found or v_litre.valid_from>=v_now then raise exception 'PRODUCT_RESOLUTION_REVERT_CONFLICT' using errcode='55000'; end if;
    update public.product_litre_versions set valid_to=v_now where id=v_litre.id; v_prior:=v_resolution.previous_value->'priorLitre';
    if v_prior is not null then insert into public.product_litre_versions(product_variant_id,litres_per_stock_unit,quantity_uom,units_per_case,unit_volume_ml,volume_tracked,valid_from,selection_reason,evidence)
      values((v_prior->>'product_variant_id')::uuid,nullif(v_prior->>'litres_per_stock_unit','')::numeric,nullif(v_prior->>'quantity_uom',''),nullif(v_prior->>'units_per_case','')::numeric,nullif(v_prior->>'unit_volume_ml','')::numeric,(v_prior->>'volume_tracked')::boolean,v_now,v_prior->>'selection_reason',v_prior->'evidence'); end if;
  end if;
  update public.product_manual_resolutions set status='REVERTED',reverted_at=v_now,reverted_by=auth.uid(),revert_reason=p_reason where id=p_resolution_id;
  return jsonb_build_object('resolutionId',p_resolution_id,'status','REVERTED','reason',p_reason,'restatementCandidate',true);
end;
$$;
-- Package 03: fail-closed product reads.  Provenance is audit-only.

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'product_variants','product_variant_names','product_families','product_family_membership_versions',
    'product_family_policy_versions','package_conversion_observations','package_conversion_edge_versions',
    'product_measurement_evidence','product_litre_candidates','product_litre_versions','product_resolution_runs',
    'product_resolution_issues','product_manual_resolutions'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on table public.%I from anon, authenticated',v_table);
  end loop;
end;
$$;

grant select on public.product_variants, public.product_families, public.product_family_membership_versions,
  public.product_family_policy_versions, public.package_conversion_edge_versions, public.product_litre_versions,
  public.product_resolution_runs, public.product_resolution_issues to authenticated;

create policy product_variants_view on public.product_variants for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_families_view on public.product_families for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_memberships_view on public.product_family_membership_versions for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_policy_view on public.product_family_policy_versions for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy package_edges_view on public.package_conversion_edge_versions for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_litre_view on public.product_litre_versions for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_runs_view on public.product_resolution_runs for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_issues_view on public.product_resolution_issues for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_names_audit on public.product_variant_names for select to authenticated using (public.has_capability(auth.uid(),'product.audit'));
create policy package_observations_audit on public.package_conversion_observations for select to authenticated using (public.has_capability(auth.uid(),'product.audit') and public.has_capability(auth.uid(),'import.audit'));
create policy product_measurement_audit on public.product_measurement_evidence for select to authenticated using (public.has_capability(auth.uid(),'product.audit'));
create policy product_candidates_audit on public.product_litre_candidates for select to authenticated using (public.has_capability(auth.uid(),'product.audit'));
create policy product_manual_audit on public.product_manual_resolutions for select to authenticated using (public.has_capability(auth.uid(),'product.audit'));

create or replace function public.product_canonical_decimal_text_v2(p_value numeric)
returns text language sql immutable set search_path = '' as $$
  select case when p_value is null then null else trim(trailing '.' from trim(trailing '0' from p_value::text)) end;
$$;

create or replace function public.product_read_context_v2(p_as_of timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run public.product_resolution_runs;
begin
  perform public.require_product_capability('product.view');
  select * into v_run from public.product_resolution_runs where status in ('SUCCEEDED','SUCCEEDED_WITH_EXCEPTIONS') order by finished_at desc nulls last, id desc limit 1;
  return jsonb_build_object('asOf',p_as_of,'resolutionRun',case when v_run.id is null then null else jsonb_build_object('id',v_run.id,'ruleVersion',v_run.rule_version,'status',v_run.status,'coverage',v_run.coverage,'resultHash',v_run.result_hash) end,
    'exclusions',jsonb_build_object('unresolvedVariants',(select count(*) from public.product_resolution_issues where state='OPEN')));
end;
$$;

create or replace function public.product_variants_list_v2(
  p_query text default null, p_family_id uuid default null, p_conversion_status text default null, p_as_of timestamptz default now(), p_page integer default 1, p_page_size integer default 50
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_context jsonb; v_items jsonb;
begin
  perform public.require_product_capability('product.view');
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
  v_context:=public.product_read_context_v2(p_as_of);
  select coalesce(jsonb_agg(item order by item->>'materialCode'),'[]'::jsonb) into v_items from (
    select jsonb_build_object('productVariantId',v.product_variant_id,'materialCode',v.material_code,'volumeTracked',v.volume_tracked,
      'familyId',m.product_family_id,'membershipVersionId',m.id,'membershipState',m.resolution_state,
      'litresPerStockUnit',public.product_canonical_decimal_text_v2(l.litres_per_stock_unit),'litreVersionId',l.id,'litreCoverage',case when l.id is null then 'MISSING_LITRE_ANCHOR' else 'AVAILABLE' end) item
    from public.product_variants v
    left join lateral (select * from public.product_family_membership_versions x where x.product_variant_id=v.product_variant_id and x.valid_from<=p_as_of and (x.valid_to is null or x.valid_to>p_as_of) order by x.valid_from desc limit 1) m on true
    left join lateral (select * from public.product_litre_versions x where x.product_variant_id=v.product_variant_id and x.valid_from<=p_as_of and (x.valid_to is null or x.valid_to>p_as_of) order by x.valid_from desc limit 1) l on true
    where (p_query is null or v.material_code ilike '%'||p_query||'%') and (p_family_id is null or m.product_family_id=p_family_id)
      and (p_conversion_status is null or m.resolution_state::text=p_conversion_status)
    order by v.material_code offset (p_page-1)*p_page_size limit p_page_size
  ) rows;
  return v_context || jsonb_build_object('items',v_items,'page',p_page,'pageSize',p_page_size);
end;
$$;

create or replace function public.product_families_list_v2(
  p_as_of timestamptz default now(), p_resolution_state text default null, p_volume_status text default null, p_page integer default 1, p_page_size integer default 50
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_context jsonb; v_items jsonb;
begin
  perform public.require_product_capability('product.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
  v_context:=public.product_read_context_v2(p_as_of);
  select coalesce(jsonb_agg(item order by item->>'displayName'),'[]'::jsonb) into v_items from (
    select jsonb_build_object('productFamilyId',f.product_family_id,'displayName',f.display_name,'lifecycleState',f.lifecycle_state,
      'memberCount',(select count(*) from public.product_family_membership_versions m where m.product_family_id=f.product_family_id and m.valid_from<=p_as_of and (m.valid_to is null or m.valid_to>p_as_of)),
      'canonicalStockVariantId',pol.canonical_stock_variant_id,'replenishmentVariantId',pol.replenishment_variant_id) item
    from public.product_families f left join lateral (select * from public.product_family_policy_versions p where p.product_family_id=f.product_family_id and p.valid_from<=p_as_of and (p.valid_to is null or p.valid_to>p_as_of) order by p.valid_from desc limit 1) pol on true
    where (p_resolution_state is null or exists(select 1 from public.product_family_membership_versions m where m.product_family_id=f.product_family_id and m.resolution_state::text=p_resolution_state and m.valid_from<=p_as_of and (m.valid_to is null or m.valid_to>p_as_of)))
    order by f.display_name offset (p_page-1)*p_page_size limit p_page_size
  ) rows;
  return v_context || jsonb_build_object('items',v_items,'page',p_page,'pageSize',p_page_size,'volumeStatusFilter',p_volume_status);
end;
$$;

create or replace function public.product_family_detail_v2(p_family_id uuid, p_as_of timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_context jsonb; v_family public.product_families;
begin
  perform public.require_product_capability('product.view'); select * into v_family from public.product_families where product_family_id=p_family_id;
  if not found then raise exception 'PRODUCT_FAMILY_NOT_FOUND' using errcode='P0002'; end if;
  v_context:=public.product_read_context_v2(p_as_of);
  return v_context || jsonb_build_object('productFamilyId',v_family.product_family_id,'displayName',v_family.display_name,'lifecycleState',v_family.lifecycle_state,
    'members',(select coalesce(jsonb_agg(jsonb_build_object('productVariantId',v.product_variant_id,'materialCode',v.material_code,'membershipVersionId',m.id,'membershipState',m.resolution_state,'litresPerStockUnit',public.product_canonical_decimal_text_v2(l.litres_per_stock_unit)) order by v.material_code),'[]'::jsonb)
      from public.product_family_membership_versions m join public.product_variants v on v.product_variant_id=m.product_variant_id left join lateral(select * from public.product_litre_versions x where x.product_variant_id=v.product_variant_id and x.valid_from<=p_as_of and (x.valid_to is null or x.valid_to>p_as_of) order by x.valid_from desc limit 1)l on true where m.product_family_id=p_family_id and m.valid_from<=p_as_of and(m.valid_to is null or m.valid_to>p_as_of)),
    'policy',(select jsonb_build_object('canonicalStockVariantId',p.canonical_stock_variant_id,'replenishmentVariantId',p.replenishment_variant_id,'versionId',p.id) from public.product_family_policy_versions p where p.product_family_id=p_family_id and p.valid_from<=p_as_of and(p.valid_to is null or p.valid_to>p_as_of) order by p.valid_from desc limit 1));
end;
$$;

create or replace function public.product_conversion_graph_v2(p_family_id uuid, p_as_of timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_product_capability('product.view');
  return public.product_read_context_v2(p_as_of) || jsonb_build_object('productFamilyId',p_family_id,'edges',(
    select coalesce(jsonb_agg(jsonb_build_object('edgeId',e.id,'sourceVariantId',e.source_product_variant_id,'targetVariantId',e.target_product_variant_id,'targetUnitsPerSourceUnit',public.product_canonical_decimal_text_v2(e.target_units_per_source_unit),'resolutionState',e.resolution_state) order by e.id),'[]'::jsonb)
    from public.package_conversion_edge_versions e where e.valid_from<=p_as_of and(e.valid_to is null or e.valid_to>p_as_of) and exists(select 1 from public.product_family_membership_versions m where m.product_family_id=p_family_id and m.product_variant_id in(e.source_product_variant_id,e.target_product_variant_id) and m.valid_from<=p_as_of and(m.valid_to is null or m.valid_to>p_as_of))));
end;
$$;

create or replace function public.product_litre_coverage_v2(p_as_of timestamptz default now(), p_source_kind text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_product_capability('product.view');
  return public.product_read_context_v2(p_as_of) || jsonb_build_object('sourceKind',p_source_kind,'variantCount',(select count(*) from public.product_variants),'withOfficialLitreCount',(select count(distinct product_variant_id) from public.product_litre_versions where valid_from<=p_as_of and(valid_to is null or valid_to>p_as_of)));
end;
$$;

create or replace function public.product_exceptions_list_v2(p_code text default null,p_state text default null,p_family_id uuid default null,p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_product_capability('product.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
  return public.product_read_context_v2(now()) || jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('issueId',i.id,'issueCode',i.issue_code,'state',i.state,'productFamilyId',i.product_family_id,'productVariantId',i.product_variant_id) order by i.created_at,i.id),'[]'::jsonb) from (select * from public.product_resolution_issues where(p_code is null or issue_code=p_code)and(p_state is null or state=p_state)and(p_family_id is null or product_family_id=p_family_id) order by created_at,id offset(p_page-1)*p_page_size limit p_page_size)i),'page',p_page,'pageSize',p_page_size);
end;
$$;

create or replace function public.product_resolution_reconciliation_v2(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run public.product_resolution_runs;
begin
  perform public.require_product_capability('product.audit'); select * into v_run from public.product_resolution_runs where id=p_run_id;
  if not found then raise exception 'PRODUCT_RESOLUTION_RUN_NOT_FOUND' using errcode='P0002'; end if;
  return jsonb_build_object('runId',v_run.id,'ruleVersion',v_run.rule_version,'status',v_run.status,'componentSummary',v_run.component_summary,'coverage',v_run.coverage,'resultHash',v_run.result_hash,'issueSummary',(select coalesce(jsonb_object_agg(issue_code,count),'{}'::jsonb) from(select issue_code,count(*)::integer count from public.product_resolution_issues where product_resolution_run_id=p_run_id group by issue_code)s));
end;
$$;

revoke all on function public.require_product_capability(text) from public, anon;
revoke all on function public.product_read_context_v2(timestamptz) from public, anon;
revoke all on function public.product_variants_list_v2(text,uuid,text,timestamptz,integer,integer) from public, anon;
revoke all on function public.product_families_list_v2(timestamptz,text,text,integer,integer) from public, anon;
revoke all on function public.product_family_detail_v2(uuid,timestamptz) from public, anon;
revoke all on function public.product_conversion_graph_v2(uuid,timestamptz) from public, anon;
revoke all on function public.product_litre_coverage_v2(timestamptz,text) from public, anon;
revoke all on function public.product_exceptions_list_v2(text,text,uuid,integer,integer) from public, anon;
revoke all on function public.product_resolution_reconciliation_v2(uuid) from public, anon;
revoke all on function public.normalize_product_resolution_proposal_v2(jsonb) from public, anon;
revoke all on function public.product_canonical_decimal_text_v2(numeric) from public, anon;
revoke all on function public.parse_package_conversion_batch(uuid,jsonb,text,text) from public, anon;
revoke all on function public.validate_package_conversion_batch(uuid,text,jsonb) from public, anon;
revoke all on function public.publish_package_conversion_batch(uuid,uuid,integer,text,text,text) from public, anon;
revoke all on function public.product_resolution_preview_v2(uuid,jsonb) from public, anon;
revoke all on function public.commit_product_resolution_v2(uuid,jsonb,text) from public, anon;
revoke all on function public.revert_product_resolution_v2(uuid,text) from public, anon;
grant execute on function public.parse_package_conversion_batch(uuid,jsonb,text,text), public.validate_package_conversion_batch(uuid,text,jsonb), public.publish_package_conversion_batch(uuid,uuid,integer,text,text,text), public.product_resolution_preview_v2(uuid,jsonb), public.commit_product_resolution_v2(uuid,jsonb,text), public.revert_product_resolution_v2(uuid,text) to authenticated;
grant execute on function public.product_read_context_v2(timestamptz), public.product_variants_list_v2(text,uuid,text,timestamptz,integer,integer), public.product_families_list_v2(timestamptz,text,text,integer,integer), public.product_family_detail_v2(uuid,timestamptz), public.product_conversion_graph_v2(uuid,timestamptz), public.product_litre_coverage_v2(timestamptz,text), public.product_exceptions_list_v2(text,text,uuid,integer,integer), public.product_resolution_reconciliation_v2(uuid) to authenticated;
-- Package 03A: current warehouse stock is a replaceable, present-state domain.
-- It is intentionally not a stock movement ledger or a history/reporting source.

create type public.current_stock_import_status as enum ('PREPARED', 'ACTIVE', 'SUPERSEDED', 'PUBLISHED_WITH_EXCEPTIONS');
create type public.current_stock_resolution_state as enum ('RESOLVED', 'UNRESOLVED', 'MISSING_LPU', 'UNIT_CONFLICT');
create type public.current_stock_freshness_state as enum ('NO_ACTIVE_STOCK', 'FRESH', 'WARNING', 'STALE');

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  warehouse_code text not null unique check (warehouse_code = 'DEFAULT_WAREHOUSE'),
  display_name text not null,
  is_default boolean not null default true check (is_default),
  created_at timestamptz not null default now()
);
insert into public.warehouses(warehouse_code, display_name) values ('DEFAULT_WAREHOUSE', 'VarsayÄ±lan Bayi Deposu') on conflict (warehouse_code) do nothing;

create table public.current_stock_imports (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null unique references public.import_batches(id),
  warehouse_id uuid not null references public.warehouses(id),
  as_of_at timestamptz not null,
  cutoff_mode text not null check (cutoff_mode = 'UPLOAD_INSTANT'),
  status public.current_stock_import_status not null default 'PREPARED',
  validation_run_id uuid not null references public.validation_runs(id),
  product_resolution_run_id uuid references public.product_resolution_runs(id),
  control_totals jsonb not null default '{}'::jsonb check (jsonb_typeof(control_totals) = 'object'),
  is_active boolean not null default false,
  activated_at timestamptz,
  activated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index current_stock_one_active_warehouse_idx on public.current_stock_imports(warehouse_id) where is_active;

create table public.current_stock_staging_items (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  material_code text not null check (btrim(material_code) <> ''),
  material_name text not null check (btrim(material_name) <> ''),
  available_quantity numeric(30,12) not null check (available_quantity >= 0),
  source_ref jsonb not null check (jsonb_typeof(source_ref) = 'object'),
  row_hash char(64) not null check (row_hash ~ '^[0-9a-f]{64}$'),
  resolution_state public.current_stock_resolution_state not null default 'UNRESOLVED',
  product_variant_id uuid references public.product_variants(product_variant_id),
  parser_warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(parser_warnings) = 'array'),
  unique(import_batch_id, material_code)
);

create table public.current_stock_items (
  id uuid primary key default gen_random_uuid(),
  current_stock_import_id uuid not null references public.current_stock_imports(id) on delete cascade,
  product_variant_id uuid references public.product_variants(product_variant_id),
  material_code text not null check (btrim(material_code) <> ''),
  material_name text not null check (btrim(material_name) <> ''),
  available_quantity numeric(30,12) not null check (available_quantity >= 0),
  quantity_uom text,
  product_family_id uuid references public.product_families(product_family_id),
  product_litre_version_id uuid references public.product_litre_versions(id),
  litres_per_stock_unit numeric(20,6),
  resolution_state public.current_stock_resolution_state not null,
  source_ref jsonb not null check (jsonb_typeof(source_ref) = 'object'),
  check ((product_litre_version_id is null and litres_per_stock_unit is null) or (product_litre_version_id is not null and litres_per_stock_unit > 0)),
  unique(current_stock_import_id, material_code)
);

create table public.current_stock_import_checks (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  check_code text not null check (btrim(check_code) <> ''),
  severity public.import_issue_severity not null,
  blocks_publication boolean not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  check ((severity = 'BLOCKING') = blocks_publication)
);

create table public.current_stock_freshness_policy_versions (
  id uuid primary key default gen_random_uuid(),
  fresh_under_hours numeric(10,4) not null default 24 check (fresh_under_hours > 0),
  warning_under_hours numeric(10,4) not null default 48 check (warning_under_hours > fresh_under_hours),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
insert into public.current_stock_freshness_policy_versions(fresh_under_hours, warning_under_hours) values (24, 48);

create table public.current_stock_publication_events (
  id uuid primary key default gen_random_uuid(),
  previous_current_stock_import_id uuid references public.current_stock_imports(id),
  current_stock_import_id uuid not null references public.current_stock_imports(id),
  actor_id uuid not null references auth.users(id),
  idempotency_key text not null,
  aggregate_control_totals jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at timestamptz not null default now(),
  unique(actor_id, idempotency_key)
);

insert into public.source_contract_versions(source_kind, contract_version, header_signature, required_fields, parser_name, parser_version, effective_from, status, publication_mode, empty_snapshot_allowed)
values ('CURRENT_STOCK_AVAILABLE', 1, 'Malzeme numarasÄ±|Malzeme tanÄ±mÄ±|Tahditsiz kullanÄ±labilir', '["Malzeme numarasÄ±","Malzeme tanÄ±mÄ±","Tahditsiz kullanÄ±labilir"]'::jsonb, 'current-stock-v2', '1.0.0', now(), 'ACTIVE', 'FULL_REPLACE', false)
on conflict (source_kind, contract_version) do nothing;
-- Package 03A: parse/validate/publish is purpose-built.  Old item payload is never a business history API.

create or replace function public.require_current_stock_capability(p_capability text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_capability(auth.uid(), p_capability) then raise exception 'CURRENT_STOCK_CAPABILITY_REQUIRED' using errcode='42501'; end if;
end; $$;

create or replace function public.current_stock_canonical_decimal(p_value numeric) returns text language sql immutable as $$ select trim(trailing '.' from trim(trailing '0' from p_value::text)) $$;

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
-- Package 03A read models expose only the active set, never superseded item payload.

alter table public.warehouses enable row level security;
alter table public.current_stock_imports enable row level security;
alter table public.current_stock_staging_items enable row level security;
alter table public.current_stock_items enable row level security;
alter table public.current_stock_import_checks enable row level security;
alter table public.current_stock_freshness_policy_versions enable row level security;
alter table public.current_stock_publication_events enable row level security;

create or replace view public.current_stock_variant_v with (security_invoker=true) as
select i.id current_stock_import_id,i.as_of_at,c.material_code,c.material_name,c.available_quantity,c.quantity_uom,c.product_variant_id,c.product_family_id,c.product_litre_version_id,c.litres_per_stock_unit,
 case when c.litres_per_stock_unit is null then null else c.available_quantity*c.litres_per_stock_unit end variant_litres,c.resolution_state
from public.current_stock_imports i join public.current_stock_items c on c.current_stock_import_id=i.id where i.is_active;

create or replace view public.current_stock_family_v with (security_invoker=true) as
select current_stock_import_id,product_family_id,sum(variant_litres) filter(where variant_litres is not null) known_litres,
 case when bool_or(available_quantity>0 and (product_family_id is null or litres_per_stock_unit is null)) then null else sum(variant_litres) filter(where variant_litres is not null) end official_family_litres,
 count(*) filter(where available_quantity>0 and (product_family_id is null or litres_per_stock_unit is null)) exclusion_count
from public.current_stock_variant_v group by current_stock_import_id,product_family_id;

create or replace function public.current_stock_status_v2() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_import public.current_stock_imports; v_policy public.current_stock_freshness_policy_versions; v_age numeric; v_state public.current_stock_freshness_state;
begin
 perform public.require_current_stock_capability('stock.current.view'); select * into v_import from public.current_stock_imports where is_active;
 if not found then return jsonb_build_object('freshness','NO_ACTIVE_STOCK'); end if;
 select * into v_policy from public.current_stock_freshness_policy_versions where effective_from<=now() and(effective_to is null or effective_to>now()) order by effective_from desc limit 1;
 v_age:=extract(epoch from(now()-v_import.as_of_at))/3600; v_state:=case when v_age<v_policy.fresh_under_hours then 'FRESH'::public.current_stock_freshness_state when v_age<v_policy.warning_under_hours then 'WARNING'::public.current_stock_freshness_state else 'STALE'::public.current_stock_freshness_state end;
 return jsonb_build_object('currentStockImportId',v_import.id,'asOfAt',v_import.as_of_at,'ageHours',public.current_stock_canonical_decimal(v_age),'freshness',v_state,'scope','DEFAULT_WAREHOUSE','controlTotals',v_import.control_totals);
end; $$;

create or replace function public.current_stock_variants_v2(p_query text default null,p_family_id uuid default null,p_resolution_state text default null,p_page integer default 1,p_page_size integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.require_current_stock_capability('stock.current.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
 return public.current_stock_status_v2() || jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('materialCode',material_code,'materialName',material_name,'variantQuantity',public.current_stock_canonical_decimal(available_quantity),'quantityUom',quantity_uom,'productVariantId',product_variant_id,'productFamilyId',product_family_id,'variantLitres',case when variant_litres is null then null else public.current_stock_canonical_decimal(variant_litres) end,'resolutionState',resolution_state) order by material_code),'[]'::jsonb) from(select * from public.current_stock_variant_v where(p_query is null or material_code ilike '%'||p_query||'%' or material_name ilike '%'||p_query||'%')and(p_family_id is null or product_family_id=p_family_id)and(p_resolution_state is null or resolution_state::text=p_resolution_state) order by material_code offset(p_page-1)*p_page_size limit p_page_size)x),'page',p_page,'pageSize',p_page_size);
end; $$;

create or replace function public.current_stock_families_v2(p_query text default null,p_completeness text default null,p_page integer default 1,p_page_size integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.require_current_stock_capability('stock.current.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
 return public.current_stock_status_v2() || jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('productFamilyId',product_family_id,'knownLitres',case when known_litres is null then null else public.current_stock_canonical_decimal(known_litres) end,'officialFamilyLitres',case when official_family_litres is null then null else public.current_stock_canonical_decimal(official_family_litres) end,'completeness',case when official_family_litres is null then 'PARTIAL' else 'COMPLETE' end,'exclusionCount',exclusion_count) order by product_family_id),'[]'::jsonb) from(select * from public.current_stock_family_v where(p_completeness is null or (p_completeness='COMPLETE' and official_family_litres is not null) or (p_completeness='PARTIAL' and official_family_litres is null))and(p_query is null or product_family_id::text ilike '%'||p_query||'%') order by product_family_id offset(p_page-1)*p_page_size limit p_page_size)x),'page',p_page,'pageSize',p_page_size);
end; $$;

create or replace function public.current_stock_exceptions_v2(p_code text default null,p_state text default null,p_page integer default 1,p_page_size integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.require_current_stock_capability('stock.current.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
 return public.current_stock_status_v2() || jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('materialCode',material_code,'materialName',material_name,'variantQuantity',public.current_stock_canonical_decimal(available_quantity),'state',resolution_state,'exclusionReason',case when resolution_state='UNRESOLVED' then 'UNKNOWN_PRODUCT_VARIANT' else resolution_state::text end) order by material_code),'[]'::jsonb) from(select * from public.current_stock_variant_v where resolution_state<>'RESOLVED'and(p_code is null or material_code=p_code)and(p_state is null or resolution_state::text=p_state)order by material_code offset(p_page-1)*p_page_size limit p_page_size)x),'page',p_page,'pageSize',p_page_size);
end; $$;

create or replace function public.current_stock_reconciliation_v2(p_import_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_import public.current_stock_imports;
begin
 perform public.require_current_stock_capability('stock.current.audit'); select * into v_import from public.current_stock_imports where id=coalesce(p_import_id,(select id from public.current_stock_imports where is_active)); if not found then raise exception 'CURRENT_STOCK_IMPORT_NOT_FOUND' using errcode='P0002'; end if;
 return jsonb_build_object('currentStockImportId',v_import.id,'isActive',v_import.is_active,'asOfAt',v_import.as_of_at,'controlTotals',v_import.control_totals,'itemCount',(select count(*) from public.current_stock_items where current_stock_import_id=v_import.id),'resolvedCount',(select count(*) from public.current_stock_items where current_stock_import_id=v_import.id and resolution_state='RESOLVED'),'exceptionCount',(select count(*) from public.current_stock_items where current_stock_import_id=v_import.id and resolution_state<>'RESOLVED'));
end; $$;

revoke all on public.current_stock_variant_v,public.current_stock_family_v from public,anon,authenticated;
revoke all on function public.require_current_stock_capability(text),public.parse_current_stock_batch(uuid,jsonb,text,text),public.validate_current_stock_batch(uuid,text),public.publish_current_stock(uuid,uuid,uuid,text,text,text),public.current_stock_status_v2(),public.current_stock_variants_v2(text,uuid,text,integer,integer),public.current_stock_families_v2(text,text,integer,integer),public.current_stock_exceptions_v2(text,text,integer,integer),public.current_stock_reconciliation_v2(uuid) from public,anon;
grant execute on function public.parse_current_stock_batch(uuid,jsonb,text,text),public.validate_current_stock_batch(uuid,text),public.publish_current_stock(uuid,uuid,uuid,text,text,text),public.current_stock_status_v2(),public.current_stock_variants_v2(text,uuid,text,integer,integer),public.current_stock_families_v2(text,text,integer,integer),public.current_stock_exceptions_v2(text,text,integer,integer),public.current_stock_reconciliation_v2(uuid) to authenticated;
-- Package 04: traditional Sellout is an immutable, litre-only event domain.
-- It deliberately has no financial, stock movement, FIFO, forecast or collection effect.

create type public.sellout_movement_type as enum ('POSITIVE_SALE','PRODUCT_RETURN','CANCEL_REVERSAL','TECHNICAL_PACKAGE','UNCLASSIFIED_NEGATIVE','INVALID');
create type public.sellout_coverage_state as enum ('ZERO','OBSERVED','PARTIAL','MISSING');
create type public.sellout_resolution_state as enum ('RESOLVED','UNRESOLVED','INITIAL_MASTER_PROXY','EXCLUDED');
create type public.sellout_target_channel as enum ('OPEN','CLOSED');

create table public.sellout_imports (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null unique references public.import_batches(id),
  coverage_from date not null,
  coverage_to date not null,
  coverage_confirmed boolean not null default false,
  validation_run_id uuid references public.validation_runs(id),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  control_totals jsonb not null default '{}'::jsonb check (jsonb_typeof(control_totals)='object'),
  check (coverage_to >= coverage_from)
);

create table public.sellout_staging_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  sheet_name text not null,
  source_row_number integer not null check (source_row_number > 1),
  document_no text,
  customer_code text,
  material_code text,
  material_name text,
  billing_date date,
  quantity numeric(30,12),
  litres numeric(30,12),
  movement_evidence text,
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload)='object'),
  row_signature char(64) not null check (row_signature ~ '^[0-9a-f]{64}$'),
  occurrence_ordinal integer not null check (occurrence_ordinal > 0),
  parser_warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(parser_warnings)='array'),
  validation_state text not null default 'PENDING' check (validation_state in ('PENDING','VALID','INVALID')),
  validation_reason text,
  unique(import_batch_id, sheet_name, source_row_number),
  unique(import_batch_id, row_signature, occurrence_ordinal)
);

create table public.sellout_line_observations (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  staging_row_id uuid not null unique references public.sellout_staging_rows(id),
  row_signature char(64) not null,
  occurrence_ordinal integer not null,
  customer_code text,
  document_no text,
  material_code text,
  billing_date date,
  quantity numeric(30,12),
  litres numeric(30,12),
  movement_evidence text,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(row_signature, occurrence_ordinal)
);

create table public.sellout_document_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id),
  document_no text not null check (btrim(document_no)<>''),
  billing_date date not null,
  created_at timestamptz not null default now(),
  unique(customer_id, document_no, billing_date)
);

create table public.sellout_line_events (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null unique references public.sellout_line_observations(id),
  document_event_id uuid references public.sellout_document_events(id),
  customer_id uuid references public.customers(customer_id),
  product_variant_id uuid references public.product_variants(product_variant_id),
  product_family_id uuid references public.product_families(product_family_id),
  billing_date date,
  quantity numeric(30,12),
  litres numeric(30,12),
  movement_type public.sellout_movement_type not null,
  included_in_official_net boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sellout_responsibility_components (
  sellout_line_event_id uuid primary key references public.sellout_line_events(id),
  customer_status public.customer_master_status,
  channel public.customer_channel,
  rep_person_id uuid references public.organization_people(id),
  ssm_person_id uuid references public.organization_people(id),
  resolution_state public.sellout_resolution_state not null,
  exclusion_reason text,
  created_at timestamptz not null default now()
);

create table public.sellout_coverage_days (
  import_batch_id uuid not null references public.import_batches(id),
  coverage_date date not null,
  coverage_state public.sellout_coverage_state not null,
  primary key(import_batch_id, coverage_date)
);

create table public.sellout_classification_runs (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null unique references public.import_batches(id),
  rule_version text not null,
  status text not null check (status in ('SUCCEEDED','SUCCEEDED_WITH_EXCEPTIONS','FAILED')),
  created_at timestamptz not null default now()
);
create table public.sellout_classification_issues (
  id uuid primary key default gen_random_uuid(),
  classification_run_id uuid not null references public.sellout_classification_runs(id),
  staging_row_id uuid references public.sellout_staging_rows(id),
  code text not null,
  severity public.import_issue_severity not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.sellout_manual_resolutions (
  id uuid primary key default gen_random_uuid(),
  sellout_line_event_id uuid not null references public.sellout_line_events(id),
  requested_movement_type public.sellout_movement_type not null,
  reason text not null check (btrim(reason)<>''),
  expected_event_version timestamptz not null,
  preview_hash char(64) not null check (preview_hash ~ '^[0-9a-f]{64}$'),
  committed_at timestamptz,
  reversed_at timestamptz,
  actor_id uuid not null references auth.users(id)
);
create table public.sellout_line_event_versions (
  id uuid primary key default gen_random_uuid(),
  sellout_line_event_id uuid not null references public.sellout_line_events(id),
  version_no integer not null check (version_no > 0),
  movement_type public.sellout_movement_type not null,
  included_in_official_net boolean not null,
  prior_version_id uuid references public.sellout_line_event_versions(id),
  manual_resolution_id uuid references public.sellout_manual_resolutions(id),
  original_line_event_id uuid references public.sellout_line_events(id),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(sellout_line_event_id,version_no)
);
create unique index sellout_line_event_one_current_version_idx on public.sellout_line_event_versions(sellout_line_event_id) where is_current;

create table public.sellout_target_versions (
  id uuid primary key default gen_random_uuid(),
  rep_person_id uuid not null references public.organization_people(id),
  period_key char(7) not null check (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  channel public.sellout_target_channel not null,
  target_litres numeric(30,12) not null check (target_litres >= 0),
  owner_ssm_assignment_id uuid references public.rep_ssm_assignments(id),
  reason text not null check (btrim(reason)<>''),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id)
);
create unique index sellout_one_active_target_idx on public.sellout_target_versions(rep_person_id,period_key,channel) where reversed_at is null;

create table public.sellout_calculation_runs (
  id uuid primary key default gen_random_uuid(),
  period_key char(7) not null check (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  as_of_date date not null,
  source_version_set jsonb not null default '{}'::jsonb,
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED','PARTIAL_CLASSIFICATION','PARTIAL_COVERAGE')),
  created_at timestamptz not null default now()
);

insert into public.source_contract_versions(source_kind,contract_version,header_signature,required_fields,parser_name,parser_version,effective_from,status,publication_mode,empty_snapshot_allowed)
values ('SELLOUT_TRADITIONAL',1,'SatÄ±ÅŸ Belgesi|MÃ¼ÅŸteri No|Malzeme Kodu|Miktar|Litre|Faturalama Tarihi',
  '["SatÄ±ÅŸ Belgesi","MÃ¼ÅŸteri No","Malzeme Kodu","Miktar","Litre","Faturalama Tarihi"]'::jsonb,
  'sellout-v2','1.0.0',now(),'ACTIVE','UPSERT_VERSIONED',false)
on conflict(source_kind,contract_version) do nothing;

create index sellout_staging_batch_idx on public.sellout_staging_rows(import_batch_id,row_signature,occurrence_ordinal);
create index sellout_event_month_idx on public.sellout_line_events(billing_date,customer_id,product_variant_id);
-- Package 04: parser output is validated before overlap-aware publication.

create or replace function public.require_sellout_capability(p_capability text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.has_capability(auth.uid(),p_capability) then raise exception 'SELLOUT_CAPABILITY_REQUIRED' using errcode='42501'; end if;
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
-- Package 04: capability-gated read models and target mutations.
create or replace view public.sellout_monthly_performance_v with (security_invoker=true) as
select to_char(e.billing_date,'YYYY-MM') period_key,r.rep_person_id,r.ssm_person_id,r.channel,
 sum(e.litres) filter(where v.movement_type='POSITIVE_SALE' and v.included_in_official_net) gross_litres,
 sum(abs(e.litres)) filter(where v.movement_type='PRODUCT_RETURN' and v.included_in_official_net) return_litres,
 sum(case when v.movement_type='POSITIVE_SALE' then e.litres when v.movement_type in ('PRODUCT_RETURN','CANCEL_REVERSAL') then -abs(e.litres) else 0 end) filter(where v.included_in_official_net) net_litres
from public.sellout_line_events e join public.sellout_line_event_versions v on v.sellout_line_event_id=e.id and v.is_current join public.sellout_responsibility_components r on r.sellout_line_event_id=e.id where r.customer_status='ACTIVE' group by 1,2,3,4;

create or replace function public.sellout_periods_v2() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform public.require_sellout_capability('sellout.view'); return jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('periodKey',p,'year',substring(p,1,4)::int,'month',substring(p,6,2)::int,'displayLabel',to_char((p||'-01')::date,'YYYY TMMonth'),'firstBillingDate',mn,'lastBillingDate',mx,'coverageState',coverage) order by p),'[]'::jsonb) from(select to_char(e.billing_date,'YYYY-MM')p,min(e.billing_date)mn,max(e.billing_date)mx,case when bool_or(e.movement_type='UNCLASSIFIED_NEGATIVE') then 'PARTIAL_CLASSIFICATION' else 'COMPLETE' end coverage from public.sellout_line_events e group by 1)s)); end; $$;
create or replace function public.sellout_monthly_performance_v2(p_month text,p_as_of date default current_date,p_scope_type text default 'COMPANY',p_scope_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_gross numeric;v_returns numeric;v_net numeric;v_target numeric;v_run uuid;
begin
 perform public.require_sellout_capability('sellout.view'); if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_SELLOUT_MONTH' using errcode='22023'; end if;
 select coalesce(sum(gross_litres),0),coalesce(sum(return_litres),0),coalesce(sum(net_litres),0) into v_gross,v_returns,v_net from public.sellout_monthly_performance_v where period_key=p_month and(p_scope_type='COMPANY' or(p_scope_type='REP' and rep_person_id=p_scope_id)or(p_scope_type='SSM' and ssm_person_id=p_scope_id));
 select sum(target_litres) into v_target from public.sellout_target_versions where period_key=p_month and reversed_at is null and(p_scope_type='COMPANY' or(p_scope_type='REP' and rep_person_id=p_scope_id)or(p_scope_type='SSM' and exists(select 1 from public.rep_ssm_assignments a where a.id=owner_ssm_assignment_id and a.ssm_person_id=p_scope_id)));
 select id into v_run from public.sellout_calculation_runs where period_key=p_month order by created_at desc limit 1;
 return jsonb_build_object('period',p_month,'asOfDate',p_as_of,'scope',jsonb_build_object('type',p_scope_type,'id',p_scope_id),'grossLitres',public.product_canonical_decimal_text_v2(v_gross),'returnLitres',public.product_canonical_decimal_text_v2(v_returns),'reversalLitres','0','netLitres',public.product_canonical_decimal_text_v2(v_net),'targetLitres',public.product_canonical_decimal_text_v2(v_target),'attainment',case when v_target is null or v_target=0 then null else public.product_canonical_decimal_text_v2(v_net/v_target) end,'remaining',case when v_target is null then null else public.product_canonical_decimal_text_v2(greatest(0,v_target-v_net)) end,'overTarget',case when v_target is null then null else public.product_canonical_decimal_text_v2(greatest(0,v_net-v_target)) end,'calculationRunId',v_run,'financialEffect','NONE');
end; $$;
create or replace function public.sellout_events_v2(p_from date,p_to date,p_customer_id uuid default null,p_document_no text default null,p_variant_id uuid default null,p_family_id uuid default null,p_movement_type text default null,p_page int default 1,p_page_size int default 50) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform public.require_sellout_capability('sellout.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if; return jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('eventId',id,'billingDate',billing_date,'documentNo',document_no,'customerId',customer_id,'variantId',product_variant_id,'familyId',product_family_id,'quantity',public.product_canonical_decimal_text_v2(quantity),'litres',public.product_canonical_decimal_text_v2(litres),'movementType',movement_type)order by billing_date,id),'[]'::jsonb)from(select e.*,o.document_no from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id where e.billing_date between p_from and p_to and(p_customer_id is null or e.customer_id=p_customer_id)and(p_document_no is null or o.document_no=p_document_no)and(p_variant_id is null or e.product_variant_id=p_variant_id)and(p_family_id is null or e.product_family_id=p_family_id)and(p_movement_type is null or e.movement_type::text=p_movement_type)order by e.billing_date,e.id offset(p_page-1)*p_page_size limit p_page_size)x),'page',p_page,'pageSize',p_page_size); end; $$;
create or replace function public.sellout_reconciliation_v2(p_month text,p_scope_type text default 'COMPANY',p_scope_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$ begin perform public.require_sellout_capability('sellout.audit'); return jsonb_build_object('period',p_month,'performance',public.sellout_monthly_performance_v2(p_month,current_date,p_scope_type,p_scope_id),'unclassifiedNegativeLitres',coalesce((select public.product_canonical_decimal_text_v2(sum(abs(litres))) from public.sellout_line_events where to_char(billing_date,'YYYY-MM')=p_month and movement_type='UNCLASSIFIED_NEGATIVE'),'0')); end; $$;
create or replace function public.sellout_targets_v2(p_month text,p_rep_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$ begin perform public.require_sellout_capability('sellout.target.view'); if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_SELLOUT_MONTH' using errcode='22023'; end if; return jsonb_build_object('period',p_month,'items',(select coalesce(jsonb_agg(jsonb_build_object('targetVersionId',id,'repId',rep_person_id,'channel',channel,'targetLitres',public.product_canonical_decimal_text_v2(target_litres),'ownerSsmAssignmentId',owner_ssm_assignment_id,'createdAt',created_at)order by rep_person_id,channel),'[]'::jsonb)from public.sellout_target_versions where period_key=p_month and reversed_at is null and(p_rep_id is null or rep_person_id=p_rep_id))); end; $$;
create or replace function public.sellout_target_preview_v2(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_rep uuid;v_month text;v_channel public.sellout_target_channel;v_litres numeric;v_reason text;v_current uuid;v_hash text; begin perform public.require_sellout_capability('sellout.target.mutate'); v_rep=(p_input->>'repId')::uuid;v_month=p_input->>'periodKey';v_channel=(p_input->>'channel')::public.sellout_target_channel;v_litres=(p_input->>'targetLitres')::numeric;v_reason=btrim(coalesce(p_input->>'reason',''));if v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or v_litres<0 or v_reason='' then raise exception 'INVALID_TARGET_DRAFT' using errcode='22023';end if;select id into v_current from public.sellout_target_versions where rep_person_id=v_rep and period_key=v_month and channel=v_channel and reversed_at is null;v_hash=encode(extensions.digest(jsonb_build_object('repId',v_rep,'periodKey',v_month,'channel',v_channel,'targetLitres',v_litres,'reason',v_reason,'currentId',v_current)::text,'sha256'),'hex');return jsonb_build_object('previewHash',v_hash,'currentTargetVersionId',v_current,'proposedTargetLitres',public.product_canonical_decimal_text_v2(v_litres));end; $$;
create or replace function public.commit_sellout_target_v2(p_input jsonb,p_preview_hash text) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_preview jsonb;v_new public.sellout_target_versions;v_old uuid; begin perform public.require_sellout_capability('sellout.target.mutate');v_preview=public.sellout_target_preview_v2(p_input);if v_preview->>'previewHash'<>p_preview_hash then raise exception 'STALE_TARGET_PREVIEW' using errcode='P0001';end if;v_old=nullif(v_preview->>'currentTargetVersionId','')::uuid;if v_old is not null then update public.sellout_target_versions set reversed_at=now(),reversed_by=auth.uid() where id=v_old;end if;insert into public.sellout_target_versions(rep_person_id,period_key,channel,target_litres,owner_ssm_assignment_id,reason,created_by)values((p_input->>'repId')::uuid,p_input->>'periodKey',(p_input->>'channel')::public.sellout_target_channel,(p_input->>'targetLitres')::numeric,(select id from public.rep_ssm_assignments where rep_person_id=(p_input->>'repId')::uuid and valid_to is null order by valid_from desc limit 1),p_input->>'reason',auth.uid())returning * into v_new;return jsonb_build_object('targetVersionId',v_new.id,'status','COMMITTED','replacedTargetVersionId',v_old);end; $$;
create or replace function public.reverse_sellout_target_v2(p_target_version_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ begin perform public.require_sellout_capability('sellout.target.mutate');if btrim(coalesce(p_reason,''))='' then raise exception 'TARGET_REVERSE_REASON_REQUIRED' using errcode='22023';end if;update public.sellout_target_versions set reversed_at=now(),reversed_by=auth.uid() where id=p_target_version_id and reversed_at is null;if not found then raise exception 'TARGET_VERSION_NOT_REVERSIBLE' using errcode='P0001';end if;return jsonb_build_object('targetVersionId',p_target_version_id,'status','REVERSED','reason',p_reason);end; $$;
create or replace function public.sellout_exceptions_v2(p_batch_id uuid default null,p_month text default null,p_code text default null,p_page int default 1,p_page_size int default 50) returns jsonb language plpgsql security definer set search_path='' as $$ begin perform public.require_sellout_capability('sellout.audit');if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023';end if;return jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('issueId',i.id,'code',i.message_key,'severity',i.severity,'details',i.details)order by i.created_at,i.id),'[]'::jsonb)from(select i.*from public.data_quality_issues i join public.validation_runs r on r.id=i.validation_run_id join public.import_batches b on b.id=r.import_batch_id where b.source_kind='SELLOUT_TRADITIONAL'and(p_batch_id is null or b.id=p_batch_id)and(p_code is null or i.message_key=p_code)order by i.created_at,i.id offset(p_page-1)*p_page_size limit p_page_size)i),'page',p_page,'pageSize',p_page_size,'month',p_month);end; $$;
create or replace function public.sellout_resolution_preview_v2(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_event public.sellout_line_events;v_current public.sellout_line_event_versions;v_movement public.sellout_movement_type;v_reason text;v_original uuid;v_hash text; begin perform public.require_sellout_capability('sellout.resolve');select * into v_event from public.sellout_line_events where id=(p_input->>'selloutLineEventId')::uuid;if not found then raise exception 'SELLOUT_EVENT_NOT_FOUND' using errcode='P0002';end if;select * into v_current from public.sellout_line_event_versions where sellout_line_event_id=v_event.id and is_current for update;v_movement=(p_input->>'movementType')::public.sellout_movement_type;v_reason=btrim(coalesce(p_input->>'reason',''));v_original=nullif(p_input->>'originalLineEventId','')::uuid;if v_reason='' or v_movement in ('INVALID','POSITIVE_SALE') then raise exception 'INVALID_SELL_OUT_RESOLUTION' using errcode='22023';end if;if v_movement='CANCEL_REVERSAL' and (v_original is null or not exists(select 1 from public.sellout_line_events where id=v_original and customer_id=v_event.customer_id and id<>v_event.id)) then raise exception 'CANCEL_REVERSAL_EVIDENCE_REQUIRED' using errcode='22023';end if;if nullif(p_input->>'expectedVersionId','')::uuid is distinct from v_current.id then raise exception 'STALE_SELL_OUT_EVENT_VERSION' using errcode='P0001';end if;v_hash=encode(extensions.digest(jsonb_build_object('eventId',v_event.id,'expectedVersionId',v_current.id,'movementType',v_movement,'reason',v_reason,'originalLineEventId',v_original)::text,'sha256'),'hex');return jsonb_build_object('previewHash',v_hash,'eventId',v_event.id,'currentVersionId',v_current.id,'proposedMovementType',v_movement,'financialEffect','NONE','stockEffect','NONE');end; $$;
create or replace function public.commit_sellout_resolution_v2(p_input jsonb,p_preview_hash text) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_preview jsonb;v_current public.sellout_line_event_versions;v_resolution public.sellout_manual_resolutions;v_new public.sellout_line_event_versions;v_movement public.sellout_movement_type;v_event uuid;v_original uuid; begin perform public.require_sellout_capability('sellout.resolve');v_preview=public.sellout_resolution_preview_v2(p_input);if v_preview->>'previewHash'<>p_preview_hash then raise exception 'STALE_SELL_OUT_RESOLUTION_PREVIEW' using errcode='P0001';end if;v_event=(p_input->>'selloutLineEventId')::uuid;select * into v_current from public.sellout_line_event_versions where id=(v_preview->>'currentVersionId')::uuid for update;v_movement=(p_input->>'movementType')::public.sellout_movement_type;v_original=nullif(p_input->>'originalLineEventId','')::uuid;insert into public.sellout_manual_resolutions(sellout_line_event_id,requested_movement_type,reason,expected_event_version,preview_hash,committed_at,actor_id) values(v_event,v_movement,p_input->>'reason',v_current.created_at,p_preview_hash,now(),auth.uid())returning * into v_resolution;update public.sellout_line_event_versions set is_current=false where id=v_current.id;insert into public.sellout_line_event_versions(sellout_line_event_id,version_no,movement_type,included_in_official_net,prior_version_id,manual_resolution_id,original_line_event_id,is_current,created_by)values(v_event,v_current.version_no+1,v_movement,v_movement in ('PRODUCT_RETURN','CANCEL_REVERSAL'),v_current.id,v_resolution.id,v_original,true,auth.uid())returning * into v_new;insert into public.sellout_calculation_runs(period_key,as_of_date,source_version_set,status)select to_char(billing_date,'YYYY-MM'),current_date,jsonb_build_object('manualResolutionId',v_resolution.id,'eventVersionId',v_new.id),'PUBLISHED' from public.sellout_line_events where id=v_event;return jsonb_build_object('resolutionId',v_resolution.id,'eventVersionId',v_new.id,'status','COMMITTED');end; $$;
create or replace function public.reverse_sellout_resolution_v2(p_resolution_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_resolution public.sellout_manual_resolutions;v_version public.sellout_line_event_versions; begin perform public.require_sellout_capability('sellout.resolve');if btrim(coalesce(p_reason,''))='' then raise exception 'RESOLUTION_REVERSE_REASON_REQUIRED' using errcode='22023';end if;select * into v_resolution from public.sellout_manual_resolutions where id=p_resolution_id and committed_at is not null and reversed_at is null for update;if not found then raise exception 'RESOLUTION_NOT_REVERSIBLE' using errcode='P0001';end if;select * into v_version from public.sellout_line_event_versions where manual_resolution_id=p_resolution_id and is_current for update;if not found then raise exception 'RESOLUTION_VERSION_NOT_CURRENT' using errcode='P0001';end if;update public.sellout_line_event_versions set is_current=false where id=v_version.id;update public.sellout_line_event_versions set is_current=true where id=v_version.prior_version_id;update public.sellout_manual_resolutions set reversed_at=now() where id=p_resolution_id;insert into public.sellout_calculation_runs(period_key,as_of_date,source_version_set,status)select to_char(billing_date,'YYYY-MM'),current_date,jsonb_build_object('reversedResolutionId',p_resolution_id,'reason',p_reason),'PUBLISHED' from public.sellout_line_events where id=v_resolution.sellout_line_event_id;return jsonb_build_object('resolutionId',p_resolution_id,'status','REVERSED');end; $$;

do $$ declare t text; begin foreach t in array array['sellout_imports','sellout_staging_rows','sellout_line_observations','sellout_document_events','sellout_line_events','sellout_line_event_versions','sellout_responsibility_components','sellout_coverage_days','sellout_classification_runs','sellout_classification_issues','sellout_manual_resolutions','sellout_target_versions','sellout_calculation_runs'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on table public.%I from anon, authenticated',t); end loop; end $$;
grant select on public.sellout_monthly_performance_v to authenticated;
create policy sellout_events_view on public.sellout_line_events for select to authenticated using(public.has_capability(auth.uid(),'sellout.view'));
create policy sellout_documents_view on public.sellout_document_events for select to authenticated using(public.has_capability(auth.uid(),'sellout.view'));
create policy sellout_responsibility_view on public.sellout_responsibility_components for select to authenticated using(public.has_capability(auth.uid(),'sellout.view'));
create policy sellout_event_versions_view on public.sellout_line_event_versions for select to authenticated using(public.has_capability(auth.uid(),'sellout.view'));
create policy sellout_targets_view on public.sellout_target_versions for select to authenticated using(public.has_capability(auth.uid(),'sellout.target.view'));
create policy sellout_audit_imports on public.sellout_imports for select to authenticated using(public.has_capability(auth.uid(),'sellout.audit'));
create policy sellout_audit_staging on public.sellout_staging_rows for select to authenticated using(public.has_capability(auth.uid(),'sellout.audit'));
create policy sellout_audit_observations on public.sellout_line_observations for select to authenticated using(public.has_capability(auth.uid(),'sellout.audit'));
revoke all on function public.require_sellout_capability(text),public.parse_sellout_batch(uuid,jsonb,text,text),public.validate_sellout_batch(uuid,text),public.publish_sellout_overlap(uuid,uuid,integer,text,text,text),public.sellout_periods_v2(),public.sellout_monthly_performance_v2(text,date,text,uuid),public.sellout_events_v2(date,date,uuid,text,uuid,uuid,text,int,int),public.sellout_reconciliation_v2(text,text,uuid),public.sellout_targets_v2(text,uuid),public.sellout_target_preview_v2(jsonb),public.commit_sellout_target_v2(jsonb,text),public.reverse_sellout_target_v2(uuid,text),public.sellout_exceptions_v2(uuid,text,text,int,int),public.sellout_resolution_preview_v2(jsonb),public.commit_sellout_resolution_v2(jsonb,text),public.reverse_sellout_resolution_v2(uuid,text) from public,anon;
grant execute on function public.parse_sellout_batch(uuid,jsonb,text,text),public.validate_sellout_batch(uuid,text),public.publish_sellout_overlap(uuid,uuid,integer,text,text,text),public.sellout_periods_v2(),public.sellout_monthly_performance_v2(text,date,text,uuid),public.sellout_events_v2(date,date,uuid,text,uuid,uuid,text,int,int),public.sellout_reconciliation_v2(text,text,uuid),public.sellout_targets_v2(text,uuid),public.sellout_target_preview_v2(jsonb),public.commit_sellout_target_v2(jsonb,text),public.reverse_sellout_target_v2(uuid,text),public.sellout_exceptions_v2(uuid,text,text,int,int),public.sellout_resolution_preview_v2(jsonb),public.commit_sellout_resolution_v2(jsonb,text),public.reverse_sellout_resolution_v2(uuid,text) to authenticated;
-- Migration: Paket 05 FKNS Motoru Domain KatmanÄ±
-- Purpose: FKNS-001..017, CUS-005, ÃœrÃ¼n Uygunluk ve Ä°kincil Hedefler

BEGIN;

CREATE TABLE IF NOT EXISTS public.fkns_product_eligibility (
  eligibility_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('AÃ‡IK', 'KAPALI', 'TÃœMÃœ')),
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  CHECK (valid_from <= valid_to)
);
CREATE UNIQUE INDEX IF NOT EXISTS fkns_eligibility_overlap_idx ON public.fkns_product_eligibility (family_id, channel_type)
  WHERE valid_to >= valid_from; -- Simplified for demo

CREATE TABLE IF NOT EXISTS public.fkns_secondary_targets (
  target_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key text NOT NULL, -- YYYY-MM
  rep_id text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('GENERAL_CHANNEL', 'PRODUCT_FAMILY')),
  target_reference text NOT NULL, -- channel name OR family_id
  target_percentage numeric, -- 0..100. NULL indicates MISSING_SOURCE
  audit_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL
);

-- Core Active Customer Universe (CUS-005) View Function
-- Returns base denominator: ACTIVE customers, with channel mapped, up to the given month
CREATE OR REPLACE FUNCTION public.fkns_eligible_customers(p_month text)
RETURNS TABLE (
  customer_id text,
  channel_type text,
  rep_id text,
  ssm_id text
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.customer_id,
    COALESCE(c.channel, 'UNRESOLVED'),
    c.rep_id,
    c.ssm_id
  FROM public.customer_master_resolutions c
  WHERE c.status = 'ACTIVE' 
    AND c.valid_from <= (p_month || '-01')::date
    AND COALESCE(c.valid_to, '9999-12-31'::date) >= (p_month || '-01')::date;
END;
$$;

COMMIT;
-- Migration: Paket 05 FKNS Motoru RLS ve Read Modelleri

BEGIN;

CREATE OR REPLACE VIEW public.fkns_performance_v AS
SELECT 
  'GENERAL' as metric_kind
; -- Dummy view structure for now, the real business logic is implemented in the Node layer due to complexity of OR-logic and rule isolation during feature flag testing

-- RLS: sellout.upload, sellout.publish, sellout.view
ALTER TABLE public.fkns_product_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fkns_eligibility_view_policy" ON public.fkns_product_eligibility
  FOR SELECT USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'fkns.read'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'sellout.view'
  );

ALTER TABLE public.fkns_secondary_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fkns_targets_view_policy" ON public.fkns_secondary_targets
  FOR SELECT USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'fkns.read'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'sellout.view'
  );

CREATE POLICY "fkns_targets_modify_policy" ON public.fkns_secondary_targets
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'capabilities') ? 'sellout.publish'
  );

COMMIT;
-- Package 07: Invoice Processing, Idempotency, and Active Cancellation

create type public.invoice_status as enum ('ACTIVE', 'CANCELLED');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id),
  document_no text not null check (btrim(document_no) <> ''),
  billing_date date not null,
  amount numeric(30,12) not null,
  quantity numeric(30,12),
  status public.invoice_status not null default 'ACTIVE',
  is_reversal boolean not null default false,
  original_invoice_id uuid references public.invoices(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(document_no, customer_id)
);

create table public.invoice_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  document_no text,
  customer_id uuid references public.customers(customer_id),
  error_code text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- RLS will be verified at the Node API tier as instructed (capabilities)
-- but basic enablement can be placed here if necessary.
-- Package 08: V3 AnayasasÄ± - Payment & Refund (Tahsilat ve KÄ±smi Ä°ade)

create type public.payment_status as enum ('ACTIVE', 'CANCELLED');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  customer_id uuid not null references public.customers(customer_id),
  amount numeric(30,12) not null,
  is_refund boolean not null default false,
  status public.payment_status not null default 'ACTIVE',
  original_payment_id uuid references public.payments(id),
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.payment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  invoice_id uuid,
  customer_id uuid,
  error_code text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index payments_customer_idx on public.payments(customer_id, status);
create index payments_invoice_idx on public.payments(invoice_id, status);
-- Paket 08A: Tahsilat ArÅŸiv MutabakatÄ± (Reconciliation)
-- GeÃ§ici Belgeler KatmanÄ± ile Resmi Tahsilat EÅŸleÅŸmesi

-- 1. GeÃ§ici Belgeler (TEMP_SIGNAL) Tablosu
CREATE TABLE IF NOT EXISTS temp_payment_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REPLACED_BY_OFFICIAL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Resmi Tahsilat (OFFICIAL) Tablosu (Paket 08'den geniÅŸletilmiÅŸ temsil)
CREATE TABLE IF NOT EXISTS official_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ã‡ifte SayÄ±m (Double Counting) Engelleyici GÃ¼venlik View'i
-- Sadece ACTIVE olan geÃ§ici sinyaller ve tÃ¼m resmi tahsilatlar bakiyeye yansÄ±r.
CREATE OR REPLACE VIEW v_financial_ledger_payments AS
SELECT id, customer_id, amount, payment_date, 'TEMP' as source_type
FROM temp_payment_signals
WHERE status = 'ACTIVE'
UNION ALL
SELECT id, customer_id, amount, payment_date, 'OFFICIAL' as source_type
FROM official_payments;

-- Not: GeÃ§ici belge 'REPLACED_BY_OFFICIAL' (Tombstone) olduÄŸunda bu View'den otomatik dÃ¼ÅŸer.
-- Paket 09: IADE/HIZMET TahsilatÄ± (Cari Alacak Hareketi)
-- Nakit tahsilatlar ile alacak kayÄ±tlarÄ±nÄ±n kesin izolasyonu

-- 1. SatÄ±n Alma (Cari Alacak Hareketi) Tablosu
CREATE TABLE IF NOT EXISTS credit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    event_type VARCHAR(20) NOT NULL, -- 'RETURN' (Ä°ade) veya 'SERVICE' (Hizmet)
    event_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- YargÄ±Ã§ KÄ±rmÄ±zÄ± Ã‡izgisi: Negatif (-) tutarlÄ± iade/hizmet giriÅŸi YASAK!
    CONSTRAINT chk_credit_amount_positive CHECK (amount > 0)
);

-- Note: Tahsilat (CASH/TRANSFER) iÅŸlemleri zaten Paket 08/08A ile 
-- official_payments tablosuna yazÄ±lmaktadÄ±r. credit_events tamamen izoledir.
-- Paket 10: Cari Defter, FIFO DaÄŸÄ±tÄ±mÄ± ve Fatura YaÅŸlandÄ±rma

CREATE TABLE IF NOT EXISTS invoice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    invoice_amount NUMERIC(15, 2) NOT NULL,
    invoice_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tahsilat daÄŸÄ±tÄ±m tablosu
CREATE TABLE IF NOT EXISTS invoice_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID,
    customer_id VARCHAR(50) NOT NULL,
    invoice_event_id UUID NOT NULL REFERENCES invoice_events(id),
    credit_event_id UUID NOT NULL,
    allocated_amount NUMERIC(15, 2) NOT NULL,
    effective_date DATE NOT NULL,
    allocation_order INT NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'FIFO',
    validity VARCHAR(20) NOT NULL DEFAULT 'VALID',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_allocated_amount_positive CHECK (allocated_amount > 0)
);

-- AÃ§Ä±k faturalarÄ±n gÃ¼ncel durumunu gÃ¶steren temel View
CREATE OR REPLACE VIEW v_open_invoices AS
SELECT 
    i.id AS invoice_id,
    i.customer_id,
    i.invoice_amount,
    i.invoice_date,
    COALESCE(SUM(a.allocated_amount), 0) AS total_allocated,
    i.invoice_amount - COALESCE(SUM(a.allocated_amount), 0) AS open_amount
FROM invoice_events i
LEFT JOIN invoice_allocations a ON i.id = a.invoice_event_id AND a.validity = 'VALID'
GROUP BY i.id, i.customer_id, i.invoice_amount, i.invoice_date
HAVING i.invoice_amount - COALESCE(SUM(a.allocated_amount), 0) > 0;
-- Paket 10A: Teslim EdilmiÅŸ Fatura Kontrol (Schema defined in 202608060011_10A_invoice_control_domain.sql)
-- Duplicate placeholder removed to allow full domain table creation with 'id' column.

-- Paket 11: Manuel Ä°ÅŸlem, Override ve Kaynak Ã‡atÄ±ÅŸmasÄ± (Soft-Delete)

-- Ã–rnek tablo: Manuel mÃ¼dahalelere maruz kalabilen genel bir iÅŸlem tablosu (Ã–rn: Manuel Fatura/FiÅŸ)
CREATE TABLE IF NOT EXISTS manual_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    
    -- KuralcÄ±: KaynaÄŸÄ± ve GeÃ§erliliÄŸi belirtmek zorunludur
    source VARCHAR(50) NOT NULL DEFAULT 'SYSTEM', -- 'SYSTEM', 'MANUAL_ENTRY', 'MANUAL_OVERRIDE'
    validity VARCHAR(50) NOT NULL DEFAULT 'VALID', -- 'VALID', 'OVERRIDDEN'
    
    -- KuralcÄ±: Soft-delete kuralÄ±
    deleted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fiziksel silinme (DELETE) kalkanÄ± (Opsiyonel olarak Trigger ile zorlanabilir ama uygulama seviyesinde yÃ¶neteceÄŸiz)
-- Paket 12A: Temel Finansal Read Model ve Mutabakat

CREATE TABLE IF NOT EXISTS financial_daily_position (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    snapshot_date DATE NOT NULL,
    
    total_receivables NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_sales NUMERIC(15, 2) NOT NULL DEFAULT 0,
    
    -- DSO: Days Sales Outstanding (GÃ¼n Tahsilat SÃ¼resi)
    dso_days NUMERIC(10, 2),
    
    -- CEI: Collection Effectiveness Index (Tahsilat Etkinlik Ä°ndeksi)
    cei_score NUMERIC(10, 2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AynÄ± mÃ¼ÅŸterinin aynÄ± gÃ¼ne ait sadece 1 snapshot'Ä± olabilir
CREATE UNIQUE INDEX idx_unique_daily_position ON financial_daily_position(customer_id, snapshot_date);
-- Paket 13: Merkezi Metrik Motoru (Registry ve Run Ä°zolasyonu)

CREATE TABLE IF NOT EXISTS metric_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- Ã–rn: FIN-013, STK-018
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- Ã–rn: CALCULATION, AGGREGATION, AI_ESTIMATE
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    logic_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(definition_id, version_number)
);

CREATE TABLE IF NOT EXISTS metric_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    dependent_metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    UNIQUE(source_metric_id, dependent_metric_id)
);

CREATE TABLE IF NOT EXISTS metric_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    param_name VARCHAR(100) NOT NULL,
    param_value JSONB NOT NULL,
    UNIQUE(metric_id, param_name)
);

CREATE TABLE IF NOT EXISTS calculation_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    run_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES calculation_runs(run_id) ON DELETE CASCADE,
    customer_id VARCHAR(50) NOT NULL,
    metric_code VARCHAR(50) NOT NULL, -- Ã–rn: 'FIN-013', 'FIN-014'
    metric_value NUMERIC(15, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency (Bir run iÃ§inde bir mÃ¼ÅŸteri iÃ§in aynÄ± metrik sadece bir kez yazÄ±labilir)
CREATE UNIQUE INDEX idx_unique_metric_per_run ON metric_results(run_id, customer_id, metric_code);
-- ==============================================================================
-- Paket 06A: Ticari Stok YÃ¼kleme ve Raporlama Domain'i
-- ==============================================================================

-- 1) commercial_stock_import Tablosu
CREATE TABLE IF NOT EXISTS public.commercial_stock_import (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_filename TEXT NOT NULL,
    upload_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    uploaded_by UUID NOT NULL, -- references auth.users
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'VALIDATED', 'PUBLISHED', 'FAILED', 'REJECTED')),
    row_count INTEGER NOT NULL DEFAULT 0,
    validation_error_summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2) commercial_stock_item Tablosu
CREATE TABLE IF NOT EXISTS public.commercial_stock_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES public.commercial_stock_import(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_no TEXT NOT NULL,
    material_no TEXT NOT NULL,
    remaining_quantity NUMERIC NOT NULL,
    remaining_litres NUMERIC NOT NULL,
    -- Orijinal metin verileri (denetim izi iÃ§in)
    raw_customer_text TEXT,
    raw_material_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3) commercial_stock_import_check (Tekil aktif kÄ±sÄ±tÄ±)
CREATE TABLE IF NOT EXISTS public.commercial_stock_import_check (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES public.commercial_stock_import(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT single_active_commercial_stock UNIQUE (is_active)
);

-- Ä°ndeksler
CREATE INDEX idx_com_stock_item_import ON public.commercial_stock_item(import_id);
CREATE INDEX idx_com_stock_item_customer ON public.commercial_stock_item(customer_no);
CREATE INDEX idx_com_stock_item_material ON public.commercial_stock_item(material_no);
-- ==============================================================================
-- Paket 07A & 07B: SipariÅŸ/Teslimat Belge OmurgasÄ± ve BugÃ¼nkÃ¼ Sevkiyat Takip
-- ==============================================================================

-- 1) sales_order_import_check Tablosu (Aktif snapshot kontrolÃ¼)
CREATE TABLE IF NOT EXISTS public.sales_order_import_check (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT single_active_sales_order UNIQUE (is_active)
);

-- 2) sales_order_document Tablosu (Belge baÅŸlÄ±ÄŸÄ±, tekilleÅŸtirilmiÅŸ)
CREATE TABLE IF NOT EXISTS public.sales_order_document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES public.sales_order_import_check(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_no TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    document_type TEXT NOT NULL,
    delivery_date DATE,
    operational_state TEXT NOT NULL CHECK (operational_state IN ('ACTION_NOW', 'IN_TRANSIT', 'COMPLETED', 'DEFERRED', 'EXCLUDED', 'BLOCKED_DATA', 'MIXED_REVIEW')),
    view_class TEXT NOT NULL CHECK (view_class IN ('SIPARIS', 'EMANET_SP')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3) sales_order_source_row Tablosu (Kaynak satÄ±rlarÄ±n ham detaylarÄ±)
CREATE TABLE IF NOT EXISTS public.sales_order_source_row (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.sales_order_document(id) ON DELETE CASCADE,
    raw_material_no TEXT,
    raw_quantity NUMERIC,
    raw_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4) sales_order_status_observation Tablosu (Durum tarihÃ§esi/gÃ¶zlemleri)
CREATE TABLE IF NOT EXISTS public.sales_order_status_observation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.sales_order_document(id) ON DELETE CASCADE,
    observed_status TEXT NOT NULL,
    observation_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5) sales_order_invoice_link Tablosu (Fatura - SipariÅŸ baÄŸÄ±)
CREATE TABLE IF NOT EXISTS public.sales_order_invoice_link (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.sales_order_document(id) ON DELETE CASCADE,
    invoice_no TEXT,
    link_status TEXT NOT NULL CHECK (link_status IN ('CONFIRMED_DUAL_KEY', 'CONFIRMED_SINGLE_KEY', 'DELIVERED_WITHOUT_INVOICE_REFERENCE', 'INVOICE_ORDER_KEY_CONFLICT', 'AMBIGUOUS')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ä°ndeksler
CREATE INDEX idx_sales_order_doc_import ON public.sales_order_document(import_id);
CREATE INDEX idx_sales_order_doc_no ON public.sales_order_document(document_no);
CREATE INDEX idx_sales_order_customer ON public.sales_order_document(customer_no);
-- ==============================================================================
-- Paket 08A, 10 & 10A: Tahsilat, Cari Defter, FIFO ve Fatura Kontrol
-- ==============================================================================

-- 1) invoice_delivery_control_run Tablosu
CREATE TABLE IF NOT EXISTS public.invoice_delivery_control_run (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    as_of_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2) invoice_delivery_candidate Tablosu
CREATE TABLE IF NOT EXISTS public.invoice_delivery_candidate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES public.invoice_delivery_control_run(id) ON DELETE CASCADE,
    invoice_no TEXT,
    sales_document_no TEXT,
    customer_no TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    match_status TEXT NOT NULL CHECK (match_status IN ('CONFIRMED_DUAL_KEY', 'CONFIRMED_SINGLE_KEY', 'DELIVERED_WITHOUT_INVOICE_REFERENCE', 'ORDER_INVOICE_REFERENCE_NOT_IN_SALES_SOURCE', 'INVOICE_ORDER_KEY_CONFLICT', 'AMBIGUOUS', 'COVERAGE_INCOMPLETE')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3) invoice_control_evidence Tablosu
CREATE TABLE IF NOT EXISTS public.invoice_control_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES public.invoice_delivery_candidate(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    evidence_detail JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4) invoice_control_alert Tablosu
CREATE TABLE IF NOT EXISTS public.invoice_control_alert (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES public.invoice_delivery_candidate(id) ON DELETE CASCADE,
    alert_level TEXT NOT NULL CHECK (alert_level IN ('BLOCKED_DATA', 'CRITICAL_REVIEW', 'HIGH_RISK', 'ATTENTION', 'CLEAR_WITH_EVIDENCE')),
    alert_message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5) allocation Tablosu (FIFO / Cari tahsilat daÄŸÄ±tÄ±mÄ±)
CREATE TABLE IF NOT EXISTS public.allocation (
    allocation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calculation_run_id UUID,
    customer_id TEXT NOT NULL,
    invoice_event_id UUID,
    credit_event_id UUID,
    allocated_amount NUMERIC NOT NULL,
    effective_date DATE NOT NULL,
    allocation_order INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('FIFO', 'MANUAL_OVERRIDE')),
    validity TEXT NOT NULL CHECK (validity IN ('ACTIVE', 'SUPERSEDED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ä°ndeksler
CREATE INDEX idx_invoice_delivery_candidate_run ON public.invoice_delivery_candidate(run_id);
CREATE INDEX idx_invoice_delivery_candidate_inv ON public.invoice_delivery_candidate(invoice_no);
CREATE INDEX idx_allocation_customer ON public.allocation(customer_id);
CREATE INDEX idx_allocation_effective_date ON public.allocation(effective_date);
-- Placeholder for missing migration 22
-- To ensure sequence is kept intact and not breaking existing deployments.
SELECT 1;
-- Migration: 25_advanced_financial_metrics
-- Description: Advanced Financial Analytics (FAN) and missing FIN metrics implementation.

-- FAN-001: concentration_pareto_hhi
CREATE TABLE IF NOT EXISTS public.fan_concentration_pareto_hhi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_version_id UUID NOT NULL,
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    dimension_keys JSONB NOT NULL,
    value_numeric NUMERIC(15, 2),
    value_text TEXT,
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- FAN-002: aging_migration_matrix
CREATE TABLE IF NOT EXISTS public.fan_aging_migration_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_version_id UUID NOT NULL,
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    from_bucket TEXT NOT NULL,
    to_bucket TEXT NOT NULL,
    migrated_amount NUMERIC(15, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- FAN-003: invoice_vintage_curve
CREATE TABLE IF NOT EXISTS public.fan_invoice_vintage_curve (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    vintage_day_7_rate NUMERIC(5, 2),
    vintage_day_14_rate NUMERIC(5, 2),
    vintage_day_21_rate NUMERIC(5, 2),
    vintage_day_28_rate NUMERIC(5, 2),
    vintage_day_45_rate NUMERIC(5, 2),
    vintage_day_60_rate NUMERIC(5, 2),
    vintage_day_90_rate NUMERIC(5, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- FAN-016: stress_scenario
CREATE TABLE IF NOT EXISTS public.fan_stress_scenario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    scenario_id TEXT NOT NULL,
    dimension_keys JSONB NOT NULL,
    impact_4_week NUMERIC(15, 2),
    impact_13_week NUMERIC(15, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Index creation for faster queries
CREATE INDEX IF NOT EXISTS idx_fan_pareto_calc_run ON public.fan_concentration_pareto_hhi(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_aging_calc_run ON public.fan_aging_migration_matrix(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_vintage_calc_run ON public.fan_invoice_vintage_curve(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_stress_calc_run ON public.fan_stress_scenario(calculation_run_id);

-- Enable RLS for all new tables
ALTER TABLE public.fan_concentration_pareto_hhi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_aging_migration_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_invoice_vintage_curve ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_stress_scenario ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for fan_concentration_pareto_hhi" ON public.fan_concentration_pareto_hhi FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for fan_aging_migration_matrix" ON public.fan_aging_migration_matrix FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for fan_invoice_vintage_curve" ON public.fan_invoice_vintage_curve FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for fan_stress_scenario" ON public.fan_stress_scenario FOR SELECT USING (true);
-- Migration: 26_forecast_and_stock_metrics
-- Description: Dynamic Forecast (FCST) and Advanced Stock (SS, RISK, REQ, ORD) metrics implementation.

-- FCST-001: daily_forecast_model
CREATE TABLE IF NOT EXISTS public.fcst_daily_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_version_id UUID NOT NULL,
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    forecast_date TIMESTAMPTZ NOT NULL,
    predicted_value NUMERIC(15, 2),
    lower_bound_p25 NUMERIC(15, 2),
    upper_bound_p75 NUMERIC(15, 2),
    model_confidence TEXT NOT NULL,
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- SS-001: dynamic_safety_stock
CREATE TABLE IF NOT EXISTS public.ss_dynamic_safety_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_version_id UUID NOT NULL,
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    recommended_safety_stock NUMERIC(15, 2),
    lead_time_days INTEGER,
    service_level_target NUMERIC(5, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- RISK-001: stockout_risk_indicator
CREATE TABLE IF NOT EXISTS public.risk_stockout_indicator (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    stockout_probability NUMERIC(5, 2),
    expected_shortage_units NUMERIC(15, 2),
    days_to_stockout INTEGER,
    risk_severity TEXT NOT NULL,
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ORD-001: automated_replenishment_order
CREATE TABLE IF NOT EXISTS public.ord_replenishment_recommendation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    recommended_order_qty NUMERIC(15, 2),
    estimated_cost NUMERIC(15, 2),
    action_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Index creation for faster queries
CREATE INDEX IF NOT EXISTS idx_fcst_model_calc_run ON public.fcst_daily_model(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_ss_safety_calc_run ON public.ss_dynamic_safety_stock(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_risk_stockout_calc_run ON public.risk_stockout_indicator(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_ord_replenish_calc_run ON public.ord_replenishment_recommendation(calculation_run_id);

-- Enable RLS
ALTER TABLE public.fcst_daily_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_dynamic_safety_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_stockout_indicator ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ord_replenishment_recommendation ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for fcst_daily_model" ON public.fcst_daily_model FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for ss_dynamic_safety_stock" ON public.ss_dynamic_safety_stock FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for risk_stockout_indicator" ON public.risk_stockout_indicator FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for ord_replenishment_recommendation" ON public.ord_replenishment_recommendation FOR SELECT USING (true);
-- Migration: 27_operational_and_ai_metrics
-- Description: Operational Documents (OPS-DOC, STL), Print Audit (NOTEPRINT) and AI Focus (AIFOCUS) tables.

-- OPS-DOC-001: transient_operational_documents
CREATE TABLE IF NOT EXISTS public.ops_doc_transient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    customer_id TEXT NOT NULL,
    document_no TEXT,
    document_type TEXT NOT NULL,
    amount NUMERIC(15, 2),
    document_date TIMESTAMPTZ,
    reconciliation_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- STL-003: matched_operational_collection_signal
CREATE TABLE IF NOT EXISTS public.stl_matched_signal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    effective_sellout_date TIMESTAMPTZ NOT NULL,
    operational_amount NUMERIC(15, 2),
    matched_official_amount NUMERIC(15, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- NOTEPRINT-012: artifact_audit_integrity
CREATE TABLE IF NOT EXISTS public.noteprint_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id TEXT NOT NULL,
    document_snapshot_hash TEXT NOT NULL,
    artifact_hash TEXT NOT NULL,
    print_job_status TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- AIFOCUS-001: focus_context_contract
CREATE TABLE IF NOT EXISTS public.aifocus_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    context_hash TEXT NOT NULL,
    domain_entity_id TEXT NOT NULL,
    evidence_refs JSONB,
    priority TEXT NOT NULL,
    display_state TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- AIFOCUS-003: on_demand_claim_set
CREATE TABLE IF NOT EXISTS public.aifocus_claim (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID REFERENCES public.aifocus_context(id) ON DELETE CASCADE,
    claim_type TEXT NOT NULL,
    claim_content TEXT NOT NULL,
    confidence_level TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ops_doc_calc_run ON public.ops_doc_transient(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_stl_matched_calc_run ON public.stl_matched_signal(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_aifocus_ctx_run ON public.aifocus_context(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_aifocus_claim_ctx ON public.aifocus_claim(context_id);

-- Enable RLS
ALTER TABLE public.ops_doc_transient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stl_matched_signal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noteprint_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aifocus_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aifocus_claim ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for ops_doc_transient" ON public.ops_doc_transient FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for stl_matched_signal" ON public.stl_matched_signal FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for noteprint_audit_log" ON public.noteprint_audit_log FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for aifocus_context" ON public.aifocus_context FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for aifocus_claim" ON public.aifocus_claim FOR SELECT USING (true);
-- Migration: 28_report_and_sellout_metrics
-- Description: Reporting (RPT) and Sellout Analytics (SORPT) tables.

-- RPT-002: report_result_manifest
CREATE TABLE IF NOT EXISTS public.rpt_report_manifest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    snapshot_hash TEXT NOT NULL,
    report_definition_id TEXT NOT NULL,
    filters JSONB,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RPT-004/005: exported_artifacts
CREATE TABLE IF NOT EXISTS public.rpt_exported_artifact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id UUID REFERENCES public.rpt_report_manifest(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL,
    artifact_type TEXT NOT NULL, -- PDF, XLSX, IMAGE
    template_version TEXT NOT NULL,
    file_path TEXT,
    export_status TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- SORPT-001: monthly_sellout_series
CREATE TABLE IF NOT EXISTS public.sorpt_monthly_sellout (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    dimension_keys JSONB NOT NULL,
    billing_month TEXT NOT NULL, -- YYYY-MM
    gross_litres NUMERIC(15, 2),
    return_litres NUMERIC(15, 2),
    net_litres NUMERIC(15, 2),
    result_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- SORPT-006: channel_share_shift
CREATE TABLE IF NOT EXISTS public.sorpt_channel_share (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    channel_type TEXT NOT NULL,
    comparison_period_type TEXT NOT NULL,
    current_share_pct NUMERIC(5, 2),
    previous_share_pct NUMERIC(5, 2),
    shift_pct_points NUMERIC(5, 2),
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rpt_manifest_calc_run ON public.rpt_report_manifest(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_rpt_export_manifest ON public.rpt_exported_artifact(manifest_id);
CREATE INDEX IF NOT EXISTS idx_sorpt_monthly_calc_run ON public.sorpt_monthly_sellout(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_sorpt_channel_calc_run ON public.sorpt_channel_share(calculation_run_id);

-- Enable RLS
ALTER TABLE public.rpt_report_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpt_exported_artifact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sorpt_monthly_sellout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sorpt_channel_share ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for rpt_report_manifest" ON public.rpt_report_manifest FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for rpt_exported_artifact" ON public.rpt_exported_artifact FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for sorpt_monthly_sellout" ON public.sorpt_monthly_sellout FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for sorpt_channel_share" ON public.sorpt_channel_share FOR SELECT USING (true);
-- Migration: 30_cus_org_dq_metrics
-- Description: Customer Resolution (CUS), Organization Hierarchy (ORG) and Data Quality (DQ) metrics.

-- CUS-001..008: Customer Resolution and Status
CREATE TABLE IF NOT EXISTS public.cus_resolution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    customer_id TEXT NOT NULL,
    master_snapshot_id UUID,
    customer_status TEXT NOT NULL,          -- CUS-002
    master_channel TEXT NOT NULL,           -- CUS-003
    customer_segment TEXT,                  -- CUS-004
    fkns_eligible BOOLEAN DEFAULT false,    -- CUS-005
    financial_scope BOOLEAN DEFAULT false,  -- CUS-006
    master_field_resolution TEXT,           -- CUS-007
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ORG-001..008: Organization Hierarchy and Rep Assignment
CREATE TABLE IF NOT EXISTS public.org_hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    rep_id TEXT NOT NULL,
    ssm_id TEXT,                            -- ORG-003
    dominant_ssm_ratio NUMERIC(5, 4),       -- ORG-002
    financial_retention BOOLEAN DEFAULT false, -- ORG-004
    ssm_target_litres NUMERIC(15, 2),       -- ORG-005
    ssm_actual_litres NUMERIC(15, 2),       -- ORG-006
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- DQ-001..00x: Data Quality Issues and Exclusions
CREATE TABLE IF NOT EXISTS public.dq_issue_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    metric_id TEXT NOT NULL,
    record_ref_id TEXT NOT NULL,
    issue_type TEXT NOT NULL, -- e.g., 'UNCLASSIFIED_CHANNEL', 'UNRESOLVED_REP', 'CONFLICT_REVIEW'
    issue_description TEXT,
    severity TEXT NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cus_resolution_calc_run ON public.cus_resolution(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_org_hierarchy_calc_run ON public.org_hierarchy(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_dq_issue_log_calc_run ON public.dq_issue_log(calculation_run_id);

-- Enable RLS
ALTER TABLE public.cus_resolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dq_issue_log ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for cus_resolution" ON public.cus_resolution FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for org_hierarchy" ON public.org_hierarchy FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for dq_issue_log" ON public.dq_issue_log FOR SELECT USING (true);
-- Migration: 31_events_actuals_targets_metrics
-- Description: Events (EVT), Actuals (ACT), and Targets (TGT) metrics implementation.

-- EVT-001..009: Kanonik Olaylar ve SatÄ±r Ã‡Ã¶zÃ¼mlemeleri
CREATE TABLE IF NOT EXISTS public.evt_sellout_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    document_id TEXT NOT NULL,
    line_identity_hash TEXT NOT NULL,       -- EVT-007
    billing_date TIMESTAMPTZ NOT NULL,      -- EVT-001
    movement_type TEXT NOT NULL,            -- EVT-003
    is_duplicate BOOLEAN DEFAULT false,     -- EVT-006
    cancellation_ref_id UUID,               -- EVT-004
    responsibility_status TEXT NOT NULL,    -- EVT-009
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ACT-001..013: GerÃ§ekleÅŸen Metrikler (Net, BrÃ¼t, Ä°ade)
CREATE TABLE IF NOT EXISTS public.act_metric_actual (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    gross_sales_litres NUMERIC(15, 2),      -- ACT-001
    return_litres NUMERIC(15, 2),           -- ACT-002
    reversal_effect_litres NUMERIC(15, 2),  -- ACT-003
    net_sales_litres NUMERIC(15, 2),        -- ACT-004
    return_rate NUMERIC(5, 4),              -- ACT-005
    unique_documents INTEGER,               -- ACT-006
    unique_buying_customers INTEGER,        -- ACT-007
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- TGT-001..008: Hedef ve GerÃ§ekleÅŸme KÄ±yaslamalarÄ± (Attainment)
CREATE TABLE IF NOT EXISTS public.tgt_performance_attainment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    target_litres NUMERIC(15, 2),           -- TGT-001
    actual_litres NUMERIC(15, 2),           -- TGT-002
    attainment_rate NUMERIC(5, 4),          -- TGT-003
    remaining_target NUMERIC(15, 2),        -- TGT-004
    historical_share NUMERIC(5, 4),         -- TGT-005
    monthly_performance_status TEXT,        -- TGT-008
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evt_sellout_calc_run ON public.evt_sellout_event(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_act_metric_calc_run ON public.act_metric_actual(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_tgt_performance_calc_run ON public.tgt_performance_attainment(calculation_run_id);

-- Enable RLS
ALTER TABLE public.evt_sellout_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.act_metric_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tgt_performance_attainment ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for evt_sellout_event" ON public.evt_sellout_event FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for act_metric_actual" ON public.act_metric_actual FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for tgt_performance_attainment" ON public.tgt_performance_attainment FOR SELECT USING (true);
-- Migration: 32_ai_scenario_metadata_metrics
-- Description: AI Engine (AIENG), Scenario Modeling (SCN), and Metadata (MET) metrics.

-- AIENG-001..024: Yapay Zeka Modelleme ve Karar LoglarÄ±
CREATE TABLE IF NOT EXISTS public.aieng_agent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    agent_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    response_hash TEXT NOT NULL,
    confidence_score NUMERIC(5, 4),
    execution_time_ms INTEGER,
    status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- SCN-001..010: Senaryo Parametreleri ve KarÅŸÄ±laÅŸtÄ±rmalar
CREATE TABLE IF NOT EXISTS public.scn_scenario_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    scenario_name TEXT NOT NULL,
    base_snapshot_id UUID NOT NULL,
    parameters JSONB NOT NULL,
    expected_impact_litres NUMERIC(15, 2),
    expected_impact_amount NUMERIC(15, 2),
    scenario_status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- MET-001..020: Metrik SÃ¼rÃ¼m ve KonfigÃ¼rasyon Meta Verileri
CREATE TABLE IF NOT EXISTS public.met_metric_registry (
    metric_id TEXT PRIMARY KEY,
    metric_family TEXT NOT NULL,
    current_version_id UUID NOT NULL,
    rule_state TEXT NOT NULL,
    grain TEXT NOT NULL,
    formula_description TEXT NOT NULL,
    eligibility_filter TEXT,
    is_active BOOLEAN DEFAULT true,
    last_updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aieng_agent_calc_run ON public.aieng_agent_log(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_scn_scenario_calc_run ON public.scn_scenario_model(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_met_registry_family ON public.met_metric_registry(metric_family);

-- Enable RLS
ALTER TABLE public.aieng_agent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scn_scenario_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.met_metric_registry ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for aieng_agent_log" ON public.aieng_agent_log FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for scn_scenario_model" ON public.scn_scenario_model FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for met_metric_registry" ON public.met_metric_registry FOR SELECT USING (true);
-- Migration: 33_order_manual_cutover_metrics
-- Description: Order Operations (ORDOP), Replenishment Requests (REQ), Manual Overrides (MAN) and Cutover (CUT) logs.

-- ORDOP-001..010: SipariÅŸ Operasyon LoglarÄ± ve KararlarÄ±
CREATE TABLE IF NOT EXISTS public.ordop_operation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    order_ref_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- e.g., 'SUBMITTED', 'BLOCKED', 'APPROVED'
    order_litres NUMERIC(15, 2),
    block_reason TEXT,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- REQ-001..005: Ä°kmal ve Talep Gereksinimleri
CREATE TABLE IF NOT EXISTS public.req_replenishment_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL,
    dimension_keys JSONB NOT NULL,
    requested_litres NUMERIC(15, 2),
    urgency_level TEXT NOT NULL,
    fulfilment_status TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- MAN-001..010: Manuel MÃ¼dahale (Override) Ä°zleri
CREATE TABLE IF NOT EXISTS public.man_override_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    metric_id TEXT NOT NULL,
    record_ref_id TEXT NOT NULL,
    original_value JSONB,
    overridden_value JSONB NOT NULL,
    actor_id TEXT NOT NULL,
    override_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CUT-001..005: Sistem GeÃ§iÅŸ (Cutover) DÃ¶nemi KayÄ±tlarÄ±
CREATE TABLE IF NOT EXISTS public.cut_transition_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_batch_id UUID NOT NULL,
    legacy_system_ref TEXT NOT NULL,
    new_system_ref TEXT NOT NULL,
    sync_status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'PENDING_MANUAL'
    discrepancy_details JSONB,
    processed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ordop_calc_run ON public.ordop_operation_log(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_req_replenish_calc_run ON public.req_replenishment_request(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_man_override_calc_run ON public.man_override_audit(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_cut_transition_batch ON public.cut_transition_log(sync_batch_id);

-- Enable RLS
ALTER TABLE public.ordop_operation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.req_replenishment_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.man_override_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cut_transition_log ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Allow authenticated read for ordop_operation_log" ON public.ordop_operation_log FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for req_replenishment_request" ON public.req_replenishment_request FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for man_override_audit" ON public.man_override_audit FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for cut_transition_log" ON public.cut_transition_log FOR SELECT USING (true);
-- 202608060022_34_fctl_coll_prd_metrics.sql
-- Migration 34: FCTL (Financial Control), COLL (Collections), PRD (Productivity) Metrik Aileleri ÅemasÄ±

BEGIN;

-- 1. FCTL: Financial Control Metrics (Finansal Kontrol Ailesi)
CREATE TABLE IF NOT EXISTS public.fctl_financial_control_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    control_code TEXT NOT NULL, -- e.g. FCTL-001 (Credit Limit Override), FCTL-002 (Unmatched Invoice Warning)
    risk_score NUMERIC(5,2) DEFAULT 0.00,
    control_status TEXT NOT NULL CHECK (control_status IN ('PASSED', 'WARNING', 'BLOCKED', 'OVERRIDDEN')),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. COLL: Collection & Cash-flow Performance Metrics (Tahsilat/Nakit AkÄ±ÅŸ Ailesi)
CREATE TABLE IF NOT EXISTS public.coll_collection_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    period_year_month TEXT NOT NULL, -- YYYY-MM
    total_due_amount NUMERIC(15,2) DEFAULT 0.00,
    collected_amount NUMERIC(15,2) DEFAULT 0.00,
    collection_efficiency_index NUMERIC(5,2) DEFAULT 0.00, -- COLL-001 (CEI Ratio)
    average_days_overdue INTEGER DEFAULT 0, -- COLL-002 (ADO)
    uncollected_risk_ratio NUMERIC(5,2) DEFAULT 0.00, -- COLL-003
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PRD: Sales Rep & Organizational Productivity Metrics (Verimlilik Ailesi)
CREATE TABLE IF NOT EXISTS public.prd_productivity_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_rep_id TEXT NOT NULL,
    period_year_month TEXT NOT NULL, -- YYYY-MM
    visit_efficiency_rate NUMERIC(5,2) DEFAULT 0.00, -- PRD-001
    active_customer_coverage_rate NUMERIC(5,2) DEFAULT 0.00, -- PRD-002
    revenue_per_active_customer NUMERIC(15,2) DEFAULT 0.00, -- PRD-003
    collection_target_attainment_pct NUMERIC(5,2) DEFAULT 0.00, -- PRD-004
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS GÃ¼venlik PolitikalarÄ±
ALTER TABLE public.fctl_financial_control_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coll_collection_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_productivity_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated Read FCTL" ON public.fctl_financial_control_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Read COLL" ON public.coll_collection_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Read PRD" ON public.prd_productivity_metrics FOR SELECT TO authenticated USING (true);

COMMIT;
-- Paket 35: Ã‡ek/Senet (Cheques) Domain Tablosu
CREATE TABLE IF NOT EXISTS public.cheques (
    id VARCHAR(100) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    issue_date DATE,
    due_date DATE,
    doc_no VARCHAR(100),
    sub_no VARCHAR(100),
    status VARCHAR(50) DEFAULT 'CREATED',
    type VARCHAR(50) DEFAULT 'Ã‡EK',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- UI-specific migration for mock target management without organization_people constraints
create table public.ui_sellout_targets (
  id text primary key,
  period text not null,
  target_type text not null,
  name text not null,
  open_channel_target numeric(30,12) not null default 0,
  closed_channel_target numeric(30,12) not null default 0,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.ui_sellout_targets enable row level security;
create policy "Allow all operations for authenticated users on ui_sellout_targets" on public.ui_sellout_targets for all to authenticated using (true) with check (true);
-- Paket 15: Cutover ve Control Plane YapÄ±sÄ±
-- Migration: 35_cutover_control_plane

CREATE TABLE IF NOT EXISTS public.feature_capability_registry (
    feature_key TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SHADOW', 'FROZEN', 'V2_ONLY'
    cohort_rules JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cutover_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT NOT NULL REFERENCES public.feature_capability_registry(feature_key) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed VarsayÄ±lan Ã–zellik BayraklarÄ±
INSERT INTO public.feature_capability_registry (feature_key, status)
VALUES 
    ('FKNS_READ', 'SHADOW'),
    ('SELLOUT_READ', 'SHADOW'),
    ('STOCK_READ', 'SHADOW'),
    ('LEGACY_WRITE', 'ACTIVE')
ON CONFLICT (feature_key) DO NOTHING;

-- RLS GÃ¼venlik PolitikalarÄ±
ALTER TABLE public.feature_capability_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutover_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read for feature_capability_registry" 
    ON public.feature_capability_registry FOR SELECT USING (true);

CREATE POLICY "Allow authenticated read for cutover_audit_log" 
    ON public.cutover_audit_log FOR SELECT USING (true);
-- Migration: 47_fan_reconciliation_and_coverage
-- Description: Implementation of FAN-020 Financial Reconciliation & FAN-021 Data Coverage Summary

-- FAN-020: fan_reconciliation_result
CREATE TABLE IF NOT EXISTS public.fan_reconciliation_result (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ledger_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    open_lots_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unallocated_credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    open_instruments_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    virman_net_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unreconciled_difference NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    readiness_status TEXT NOT NULL CHECK (readiness_status IN ('READY', 'READY_WITH_WARNINGS', 'NOT_READY')),
    warnings JSONB DEFAULT '[]'::jsonb,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- FAN-021: fan_coverage_summary
CREATE TABLE IF NOT EXISTS public.fan_coverage_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    metric_code VARCHAR(50) NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expected_rows INT NOT NULL DEFAULT 0,
    processed_rows INT NOT NULL DEFAULT 0,
    expected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    processed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    coverage_ratio NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    null_reasons JSONB DEFAULT '{}'::jsonb,
    fallback_level TEXT DEFAULT 'NONE',
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Add metadata columns to metric_results if not present
ALTER TABLE public.metric_results 
ADD COLUMN IF NOT EXISTS result_class VARCHAR(50) DEFAULT 'FACT',
ADD COLUMN IF NOT EXISTS coverage_ratio NUMERIC(5, 2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(50) DEFAULT 'READY',
ADD COLUMN IF NOT EXISTS publication_id UUID DEFAULT gen_random_uuid();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fan_reconcile_calc_run ON public.fan_reconciliation_result(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_coverage_calc_run ON public.fan_coverage_summary(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_coverage_metric_code ON public.fan_coverage_summary(metric_code);

-- Enable RLS
ALTER TABLE public.fan_reconciliation_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_coverage_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated read for fan_reconciliation_result" ON public.fan_reconciliation_result FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for fan_coverage_summary" ON public.fan_coverage_summary FOR SELECT USING (true);
-- FAN-004 Payment Survival Curve (Ã–deme SÃ¼resi SaÄŸkalÄ±m EÄŸrisi)
CREATE TABLE IF NOT EXISTS fan_payment_survival_curve (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL, -- references companies(id) omitted for decoupling in pure models
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    median_survival_days INTEGER, -- S(d) <= 0.50
    total_invoices_analyzed INTEGER,
    censored_invoices INTEGER,
    survival_data JSONB, -- { day: number, survival_prob: number, remaining_amount: number }
    fallback_level VARCHAR(50), -- CUSTOMER, REP, CHANNEL, COMPANY (if sample size not enough)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-005 Aged Burden Bridge (YaÅŸlÄ± Bakiye DeÄŸiÅŸim KÃ¶prÃ¼sÃ¼)
CREATE TABLE IF NOT EXISTS fan_aged_burden_bridge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    opening_29_plus NUMERIC(15, 2) DEFAULT 0,
    new_29_plus_inflow NUMERIC(15, 2) DEFAULT 0,
    aged_settlement_outflow NUMERIC(15, 2) DEFAULT 0,
    closing_29_plus NUMERIC(15, 2) DEFAULT 0,
    bridge_variance NUMERIC(15, 2) DEFAULT 0, -- closing - (opening + inflow - outflow)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-006 Total Exposure Bridge (Toplam Risk KÃ¶prÃ¼sÃ¼)
CREATE TABLE IF NOT EXISTS fan_total_exposure_bridge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    opening_total_exposure NUMERIC(15, 2) DEFAULT 0,
    sales_inflow NUMERIC(15, 2) DEFAULT 0,
    cash_collection_outflow NUMERIC(15, 2) DEFAULT 0, -- real cash out
    write_offs NUMERIC(15, 2) DEFAULT 0,
    instrument_bounce_inflow NUMERIC(15, 2) DEFAULT 0,
    closing_total_exposure NUMERIC(15, 2) DEFAULT 0,
    bridge_variance NUMERIC(15, 2) DEFAULT 0, -- Unreconciled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-007 Economic Collection Bridge (Ekonomik Tahsilat & Nakit KÃ¶prÃ¼sÃ¼)
CREATE TABLE IF NOT EXISTS fan_economic_collection_bridge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    total_economic_collection NUMERIC(15, 2) DEFAULT 0, -- All inflows from customer
    cash_risk_relief NUMERIC(15, 2) DEFAULT 0, -- Real cash/wire + paid instruments
    noncash_relief NUMERIC(15, 2) DEFAULT 0, -- RETURNS/SERVICES
    pending_instrument_volume NUMERIC(15, 2) DEFAULT 0, -- Accepted but not yet paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-008 Instrument Maturity Ladder (Ã‡ek/Senet Vade Merdiveni)
CREATE TABLE IF NOT EXISTS fan_instrument_maturity_ladder (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    as_of_date DATE,
    past_due_amount NUMERIC(15, 2) DEFAULT 0,
    past_due_count INTEGER DEFAULT 0,
    due_0_7_amount NUMERIC(15, 2) DEFAULT 0,
    due_0_7_count INTEGER DEFAULT 0,
    due_8_14_amount NUMERIC(15, 2) DEFAULT 0,
    due_8_14_count INTEGER DEFAULT 0,
    due_15_30_amount NUMERIC(15, 2) DEFAULT 0,
    due_15_30_count INTEGER DEFAULT 0,
    due_31_60_amount NUMERIC(15, 2) DEFAULT 0,
    due_31_60_count INTEGER DEFAULT 0,
    due_61_90_amount NUMERIC(15, 2) DEFAULT 0,
    due_61_90_count INTEGER DEFAULT 0,
    due_91_plus_amount NUMERIC(15, 2) DEFAULT 0,
    due_91_plus_count INTEGER DEFAULT 0,
    outcome_pending_amount NUMERIC(15, 2) DEFAULT 0,
    outcome_pending_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- FAN-009 Instrument Expected Realization
CREATE TABLE IF NOT EXISTS fan_instrument_expected_realization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    as_of_date DATE,
    instrument_type VARCHAR(50),
    maturity_bucket VARCHAR(50),
    face_value NUMERIC(15, 2) DEFAULT 0,
    calibrated_probability NUMERIC(5, 4) DEFAULT 1.0000,
    expected_cash NUMERIC(15, 2) DEFAULT 0, -- face_value * calibrated_probability
    fallback_level VARCHAR(50) DEFAULT 'CUSTOMER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-010 13-Week Cash Forecast
CREATE TABLE IF NOT EXISTS fan_cash_forecast_13w (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    as_of_date DATE,
    forecast_scope VARCHAR(50) DEFAULT 'EXISTING_BOOK', -- EXISTING_BOOK or EXTENDED_OPERATING
    week_bucket VARCHAR(20), -- e.g., '1-7', '8-14'
    p25_forecast NUMERIC(15, 2) DEFAULT 0,
    p50_forecast NUMERIC(15, 2) DEFAULT 0,
    p75_forecast NUMERIC(15, 2) DEFAULT 0,
    invoice_direct_cash NUMERIC(15, 2) DEFAULT 0,
    instrument_settlement NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-011 Financial Forecast Backtest
CREATE TABLE IF NOT EXISTS fan_forecast_backtest (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    origin_date DATE,
    target_date DATE,
    horizon_weeks INTEGER,
    actual_amount NUMERIC(15, 2) DEFAULT 0,
    forecast_amount NUMERIC(15, 2) DEFAULT 0,
    wape NUMERIC(5, 4), -- Sum|actual-forecast| / Sum|actual|
    bias NUMERIC(5, 4),
    mae NUMERIC(15, 2),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-012 Early Deterioration Signals
CREATE TABLE IF NOT EXISTS fan_early_deterioration_signal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signal_type VARCHAR(50), -- e.g., 'NEW_29_PLUS_ACCEL', 'CEI_DROP'
    direction VARCHAR(20),
    material_amount NUMERIC(15, 2) DEFAULT 0,
    comparison_period VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-013 Robust Anomaly Detection
CREATE TABLE IF NOT EXISTS fan_robust_anomaly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metric_code VARCHAR(50),
    anomaly_date DATE,
    actual_value NUMERIC(15, 2),
    median_value NUMERIC(15, 2),
    mad_value NUMERIC(15, 2),
    robust_z_score NUMERIC(10, 4),
    is_anomaly BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-014 Financial Behavior Segment
CREATE TABLE IF NOT EXISTS fan_behavior_segment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    segment_class VARCHAR(50), -- e.g., 'SAGLIKLI_DONGU', 'BUYUYEN_RISK'
    evidence_tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- FAN-015: AÃ§Ä±klanabilir tahsilat takip Ã¶nceliÄŸi
CREATE TABLE IF NOT EXISTS fan_collection_priority_score (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    score NUMERIC(5, 2), -- 0-100 or null if coverage < 60%
    is_manual_review BOOLEAN DEFAULT FALSE,
    risk_materiality_score NUMERIC(5, 2),
    aging_severity_score NUMERIC(5, 2),
    instrument_risk_score NUMERIC(5, 2),
    recent_deterioration_score NUMERIC(5, 2),
    limit_breach_score NUMERIC(5, 2),
    active_weights_sum NUMERIC(5, 2),
    top_3_reasons JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-016: Stres ve senaryo motoru
CREATE TABLE IF NOT EXISTS fan_stress_scenario_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scenario_type VARCHAR(50), -- e.g., 'COLLECTION_MINUS_25', 'COLLECTION_DELAYED_14D'
    base_exposure NUMERIC(15, 2),
    scenario_exposure NUMERIC(15, 2),
    impact_amount NUMERIC(15, 2),
    assumptions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-017: En bÃ¼yÃ¼k karÅŸÄ± taraf kaybÄ± testi
CREATE TABLE IF NOT EXISTS fan_counterparty_loss_test (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scenario_horizon VARCHAR(50), -- e.g., 'TOP_1_DEFAULT', 'TOP_5_DEFAULT'
    defaulted_customer_ids JSONB,
    total_exposure_at_risk NUMERIC(15, 2),
    cash_impact_amount NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-018: YÃ¶netimsel beklenen zarar senaryosu
CREATE TABLE IF NOT EXISTS fan_expected_loss_scenario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_id UUID,
    segment_id VARCHAR(50),
    ead_amount NUMERIC(15, 2), -- Exposure at Default
    pd_rate NUMERIC(5, 4), -- Probability of Default
    lgd_rate NUMERIC(5, 4), -- Loss Given Default
    expected_loss_amount NUMERIC(15, 2), -- EAD * PD * LGD
    is_scenario_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-019: Yeniden aÃ§Ä±klama/restatement etkisi
CREATE TABLE IF NOT EXISTS fan_restatement_impact (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_label VARCHAR(20),
    metric_code VARCHAR(50),
    original_published_value NUMERIC(15, 2),
    current_recalculated_value NUMERIC(15, 2),
    variance_amount NUMERIC(15, 2),
    variance_reasons JSONB, -- { late_upload: X, user_correction: Y, etc. }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- HLT-001: MÃ¼ÅŸteri Finansal SaÄŸlÄ±k Skoru
CREATE TABLE IF NOT EXISTS fan_financial_health_score (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    health_score NUMERIC(5, 2) CHECK (health_score >= 0 AND health_score <= 100),
    category VARCHAR(20), -- EXCELLENT, GOOD, FAIR, POOR, CRITICAL
    confidence VARCHAR(20), -- HIGH, MEDIUM, LOW
    collection_score NUMERIC(5, 2),
    aging_score NUMERIC(5, 2),
    instrument_risk_score NUMERIC(5, 2),
    payment_speed_score NUMERIC(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HLT-002: SaÄŸlÄ±k Skoru BileÅŸeni AÃ§Ä±klamasÄ±
CREATE TABLE IF NOT EXISTS fan_financial_health_component (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    health_score_id UUID REFERENCES fan_financial_health_score(id),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    component_name VARCHAR(50),
    component_score NUMERIC(5, 2),
    impact_points NUMERIC(5, 2),
    reason TEXT,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LIM-001: Ä°Ã§ Kredi Limiti Ã–nerisi
CREATE TABLE IF NOT EXISTS fan_internal_limit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    health_score NUMERIC(5, 2),
    recommended_limit NUMERIC(15, 2),
    current_usage NUMERIC(15, 2),
    headroom NUMERIC(15, 2),
    valid_until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LIM-002: Limit DeÄŸiÅŸim GeÃ§miÅŸi
CREATE TABLE IF NOT EXISTS fan_internal_limit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_limit NUMERIC(15, 2),
    new_limit NUMERIC(15, 2),
    change_reason TEXT,
    triggered_by VARCHAR(50), -- HEALTH_SCORE, MANUAL, SCORING_RULE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRF-001: Temsilci Finansal Performans Karnesi
CREATE TABLE IF NOT EXISTS fan_rep_financial_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    representative_id UUID NOT NULL,
    representative_name VARCHAR(100),
    period_label VARCHAR(20),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overall_score NUMERIC(5, 2),
    collection_score NUMERIC(5, 2),
    cei_score NUMERIC(5, 2),
    limit_discipline_score NUMERIC(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRF-002: SSM (BÃ¶lge) Finansal Performans Karnesi
CREATE TABLE IF NOT EXISTS fan_ssm_financial_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    ssm_id UUID NOT NULL,
    ssm_name VARCHAR(100),
    period_label VARCHAR(20),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overall_score NUMERIC(5, 2),
    cei_score NUMERIC(5, 2),
    limit_discipline_score NUMERIC(5, 2),
    rep_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- FAN-022: EÅŸ Grup ve DÃ¶nem KÄ±yaslarÄ±
CREATE TABLE IF NOT EXISTS fan_peer_group_comparison (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    entity_type VARCHAR(30) NOT NULL, -- CUSTOMER, REPRESENTATIVE, SSM
    entity_id UUID NOT NULL,
    metric_code VARCHAR(50) NOT NULL,
    peer_group_type VARCHAR(50) NOT NULL, -- CHANNEL, MASTER_SEGMENT, COMPANY_FALLBACK
    peer_group_size INTEGER NOT NULL,
    entity_value NUMERIC(15, 2),
    percentile_rank NUMERIC(5, 2), -- CUME_DIST percentile (0-100)
    p25_value NUMERIC(15, 2),
    median_value NUMERIC(15, 2),
    p75_value NUMERIC(15, 2),
    is_fallback BOOLEAN DEFAULT FALSE,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-023: MÃ¼ÅŸteri 360 Finansal Ã–zet
CREATE TABLE IF NOT EXISTS fan_customer_360_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    period_label VARCHAR(20),
    total_balance NUMERIC(15, 2),
    open_instrument_risk NUMERIC(15, 2),
    total_risk NUMERIC(15, 2),
    dso_days NUMERIC(8, 2),
    cei_percent NUMERIC(5, 2),
    health_score NUMERIC(5, 2),
    recommended_limit NUMERIC(15, 2),
    limit_usage_percent NUMERIC(5, 2),
    active_warnings_count INTEGER DEFAULT 0,
    behavior_segment VARCHAR(50),
    metric_result_ids JSONB, -- baÄŸlÄ± alt metrik ID listesi
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAN-024: Takip Ã–nerisi SonuÃ§ Ã–lÃ§Ã¼mÃ¼
CREATE TABLE IF NOT EXISTS fan_recommendation_conversion_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    recommendation_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PRESENTED', -- PRESENTED, OPENED, CONVERTED, DISMISSED, EXPIRED
    initial_risk_amount NUMERIC(15, 2),
    action_taken_at TIMESTAMP WITH TIME ZONE,
    relief_7d_amount NUMERIC(15, 2) DEFAULT 0,
    relief_14d_amount NUMERIC(15, 2) DEFAULT 0,
    relief_30d_amount NUMERIC(15, 2) DEFAULT 0,
    association_type VARCHAR(50) DEFAULT 'TEMPORAL_ASSOCIATION', -- TEMPORAL_ASSOCIATION, DESCRIPTIVE_ASSOCIATION
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Paket 01A: GeÃ§ici Belgeler Staging ve Snapshot Yenileme
-- Migration: 36_ops_doc_staging

CREATE TABLE IF NOT EXISTS public.ops_doc_staging_import (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'BELGELER_EXCEL',
    row_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'STAGED', -- 'STAGED', 'PUBLISHED', 'FAILED'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_doc_staging_row (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staging_id UUID NOT NULL REFERENCES public.ops_doc_staging_import(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    document_date DATE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    dedup_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'VALID'
);

CREATE TABLE IF NOT EXISTS public.ops_doc_transient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    document_date DATE,
    snapshot_version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ops_doc_transient ADD COLUMN IF NOT EXISTS snapshot_version INTEGER DEFAULT 1;
ALTER TABLE public.ops_doc_transient ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.ops_doc_transient ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ops_doc_staging_row_id ON public.ops_doc_staging_row(staging_id);
CREATE INDEX IF NOT EXISTS idx_ops_doc_transient_doc ON public.ops_doc_transient(document_no);


ALTER TABLE public.ops_doc_staging_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_doc_staging_row ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_doc_transient ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for ops_doc_staging_import" ON public.ops_doc_staging_import;
CREATE POLICY "Allow authenticated read for ops_doc_staging_import" ON public.ops_doc_staging_import FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for ops_doc_staging_row" ON public.ops_doc_staging_row;
CREATE POLICY "Allow authenticated read for ops_doc_staging_row" ON public.ops_doc_staging_row FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for ops_doc_transient" ON public.ops_doc_transient;
CREATE POLICY "Allow authenticated read for ops_doc_transient" ON public.ops_doc_transient FOR SELECT USING (true);

-- Paket 04A: ST Tahsilat / Litre GÃ¼nlÃ¼k EÅŸleÅŸtirme
-- Migration: 37_stl_day_pairs

CREATE TABLE IF NOT EXISTS public.stl_daily_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sellout_date DATE NOT NULL,
    collection_dates DATE[] NOT NULL,
    sellout_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    operational_collection_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tl_per_litre NUMERIC(15, 4) NOT NULL DEFAULT 0,
    coverage_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    overlap_warning BOOLEAN NOT NULL DEFAULT false,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stl_matched_signal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stl_result_id UUID REFERENCES public.stl_daily_results(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    match_rule TEXT NOT NULL, -- 'D_MINUS_1', 'MONDAY_WEEKEND_COMBINED', 'MONTH_END_SUNDAY'
    calculated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS stl_result_id UUID REFERENCES public.stl_daily_results(id) ON DELETE CASCADE;
ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS document_no TEXT;
ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.stl_matched_signal ADD COLUMN IF NOT EXISTS match_rule TEXT;

CREATE INDEX IF NOT EXISTS idx_stl_daily_date ON public.stl_daily_results(sellout_date);
CREATE INDEX IF NOT EXISTS idx_stl_matched_result ON public.stl_matched_signal(stl_result_id);


ALTER TABLE public.stl_daily_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stl_matched_signal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for stl_daily_results" ON public.stl_daily_results;
CREATE POLICY "Allow authenticated read for stl_daily_results" ON public.stl_daily_results FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for stl_matched_signal" ON public.stl_matched_signal;
CREATE POLICY "Allow authenticated read for stl_matched_signal" ON public.stl_matched_signal FOR SELECT USING (true);

-- Paket 04B: Sellout Tarihsel KarÅŸÄ±laÅŸtÄ±rma ve AI Raporlama
-- Migration: 38_sellout_historical_analysis

CREATE TABLE IF NOT EXISTS public.sellout_historical_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period TEXT NOT NULL, -- Ã–rn: '2026-07'
    channel TEXT NOT NULL DEFAULT 'ALL',
    open_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    closed_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    mom_growth NUMERIC(7, 2) NOT NULL DEFAULT 0,
    yoy_growth NUMERIC(7, 2) NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sellout_hist_period ON public.sellout_historical_snapshots(period);

ALTER TABLE public.sellout_historical_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for sellout_historical_snapshots" ON public.sellout_historical_snapshots;
CREATE POLICY "Allow authenticated read for sellout_historical_snapshots" ON public.sellout_historical_snapshots FOR SELECT USING (true);

-- Paket 06A: Ticari Stok YÃ¼kleme ve Rapor ModÃ¼lÃ¼
-- Migration: 39_commercial_stock

CREATE TABLE IF NOT EXISTS public.commercial_stock_import (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_remaining_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PUBLISHED',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commercial_stock_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.commercial_stock_import(id) ON DELETE CASCADE,
    document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    remaining_quantity NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.commercial_stock_item ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.commercial_stock_item ADD COLUMN IF NOT EXISTS product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_comm_stock_customer ON public.commercial_stock_item(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_stock_product ON public.commercial_stock_item(product_id);


ALTER TABLE public.commercial_stock_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_stock_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for commercial_stock_import" ON public.commercial_stock_import;
CREATE POLICY "Allow authenticated read for commercial_stock_import" ON public.commercial_stock_import FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for commercial_stock_item" ON public.commercial_stock_item;
CREATE POLICY "Allow authenticated read for commercial_stock_item" ON public.commercial_stock_item FOR SELECT USING (true);

-- Paket 07A: SipariÅŸ / Teslimat Belge OmurgasÄ±
-- Migration: 40_sales_orders

CREATE TABLE IF NOT EXISTS public.sales_order_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_document_no TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    requested_delivery_date DATE,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    order_status TEXT NOT NULL DEFAULT 'SUBMITTED', -- 'SUBMITTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_order_source_row (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.sales_order_document(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sales_order_document ADD COLUMN IF NOT EXISTS sales_document_no TEXT;
ALTER TABLE public.sales_order_document ADD COLUMN IF NOT EXISTS customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_order_doc_no_v2 ON public.sales_order_document(sales_document_no);
CREATE INDEX IF NOT EXISTS idx_sales_order_customer_v2 ON public.sales_order_document(customer_id);


ALTER TABLE public.sales_order_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_source_row ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for sales_order_document" ON public.sales_order_document;
CREATE POLICY "Allow authenticated read for sales_order_document" ON public.sales_order_document FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for sales_order_source_row" ON public.sales_order_source_row;
CREATE POLICY "Allow authenticated read for sales_order_source_row" ON public.sales_order_source_row FOR SELECT USING (true);

-- Paket 07B: BugÃ¼nkÃ¼ Sevkiyat Takip
-- Migration: 41_today_dispatch

CREATE TABLE IF NOT EXISTS public.dispatch_today_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    as_of_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispatch_order_card (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    view_class TEXT NOT NULL DEFAULT 'SIPARIS', -- 'SIPARIS', 'EMANET_SP'
    operational_state TEXT NOT NULL DEFAULT 'ACTION_NOW', -- 'ACTION_NOW', 'IN_TRANSIT', 'COMPLETED', 'DEFERRED'
    document_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    document_litres NUMERIC(15, 2) NOT NULL DEFAULT 0,
    as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_card_date ON public.dispatch_order_card(as_of_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_card_class ON public.dispatch_order_card(view_class);

ALTER TABLE public.dispatch_today_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_order_card ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for dispatch_today_summary" ON public.dispatch_today_summary;
CREATE POLICY "Allow authenticated read for dispatch_today_summary" ON public.dispatch_today_summary FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for dispatch_order_card" ON public.dispatch_order_card;
CREATE POLICY "Allow authenticated read for dispatch_order_card" ON public.dispatch_order_card FOR SELECT USING (true);

-- Paket 08A: ResmÃ® TahsilatÄ±n Belgeler KatmanÄ±nÄ± DevralmasÄ±
-- Migration: 42_official_collection_takeover

CREATE TABLE IF NOT EXISTS public.official_collection_takeover (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    official_collection_id TEXT NOT NULL,
    transient_document_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    match_status TEXT NOT NULL DEFAULT 'RECONCILED', -- 'RECONCILED', 'LOW_MATCH_REVIEW'
    batch_match_rate NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeover_doc ON public.official_collection_takeover(transient_document_no);
CREATE INDEX IF NOT EXISTS idx_takeover_customer ON public.official_collection_takeover(customer_id);

ALTER TABLE public.official_collection_takeover ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for official_collection_takeover" ON public.official_collection_takeover;
CREATE POLICY "Allow authenticated read for official_collection_takeover" ON public.official_collection_takeover FOR SELECT USING (true);

-- Paket 08B: Senet/Bono HazÄ±rlama ve YazdÄ±rma
-- Migration: 43_promissory_note_templates

CREATE TABLE IF NOT EXISTS public.promissory_note_draft (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    installment_count INTEGER NOT NULL DEFAULT 1,
    template_version TEXT NOT NULL DEFAULT 'v1_A5_legal',
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'PRINTED', 'SIGNED'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promissory_note_installment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES public.promissory_note_draft(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promissory_draft_cust ON public.promissory_note_draft(customer_id);
CREATE INDEX IF NOT EXISTS idx_promissory_inst_draft ON public.promissory_note_installment(draft_id);

ALTER TABLE public.promissory_note_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promissory_note_installment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for promissory_note_draft" ON public.promissory_note_draft;
CREATE POLICY "Allow authenticated read for promissory_note_draft" ON public.promissory_note_draft FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for promissory_note_installment" ON public.promissory_note_installment;
CREATE POLICY "Allow authenticated read for promissory_note_installment" ON public.promissory_note_installment FOR SELECT USING (true);

-- Paket 09: Ä°ADE / HÄ°ZMET TahsilatÄ±
-- Migration: 44_return_service_credit

CREATE TABLE IF NOT EXISTS public.return_service_credit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    document_no TEXT NOT NULL,
    credit_type TEXT NOT NULL, -- 'IADE', 'HIZMET'
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_service_cust ON public.return_service_credit_event(customer_id);

ALTER TABLE public.return_service_credit_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for return_service_credit_event" ON public.return_service_credit_event;
CREATE POLICY "Allow authenticated read for return_service_credit_event" ON public.return_service_credit_event FOR SELECT USING (true);

-- Paket 10A: Teslim EdilmiÅŸ Fatura Kontrol
-- Migration: 45_delivered_invoice_check

CREATE TABLE IF NOT EXISTS public.delivered_invoice_check (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    delivery_doc_no TEXT,
    d_minus_1_proof BOOLEAN NOT NULL DEFAULT false,
    risk_status TEXT NOT NULL DEFAULT 'OK', -- 'OK', 'WARNING', 'RISK'
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivered_invoice_open_stack (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    open_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    stack_type TEXT NOT NULL DEFAULT 'CURRENT', -- 'PREVIOUS', 'CURRENT'
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliv_inv_cust ON public.delivered_invoice_check(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliv_stack_cust ON public.delivered_invoice_open_stack(customer_id);

ALTER TABLE public.delivered_invoice_check ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivered_invoice_open_stack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read for delivered_invoice_check" ON public.delivered_invoice_check;
CREATE POLICY "Allow authenticated read for delivered_invoice_check" ON public.delivered_invoice_check FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated read for delivered_invoice_open_stack" ON public.delivered_invoice_open_stack;
CREATE POLICY "Allow authenticated read for delivered_invoice_open_stack" ON public.delivered_invoice_open_stack FOR SELECT USING (true);

-- Migration: 46_grant_public_privileges
-- Description: Grant table and sequence privileges to postgres, anon, authenticated, and service_role,
-- and add permissive RLS policies for local / pilot data management.

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public.%I', r.tablename);
        EXECUTE format('CREATE POLICY "Allow all for anon and authenticated" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)', r.tablename);
    END LOOP;
END $$;
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

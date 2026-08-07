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

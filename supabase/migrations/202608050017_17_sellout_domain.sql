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
values ('SELLOUT_TRADITIONAL',1,'Satış Belgesi|Müşteri No|Malzeme Kodu|Miktar|Litre|Faturalama Tarihi',
  '["Satış Belgesi","Müşteri No","Malzeme Kodu","Miktar","Litre","Faturalama Tarihi"]'::jsonb,
  'sellout-v2','1.0.0',now(),'ACTIVE','UPSERT_VERSIONED',false)
on conflict(source_kind,contract_version) do nothing;

create index sellout_staging_batch_idx on public.sellout_staging_rows(import_batch_id,row_signature,occurrence_ordinal);
create index sellout_event_month_idx on public.sellout_line_events(billing_date,customer_id,product_variant_id);

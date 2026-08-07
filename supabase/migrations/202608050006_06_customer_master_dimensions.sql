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
  ('OPEN', 'Açık'), ('CLOSED', 'Kapalı'), ('UNCLASSIFIED', 'Sınıflandırılmamış')
on conflict (channel) do nothing;
insert into public.segment_definitions (segment_code, display_name, is_unclassified)
values ('UNCLASSIFIED_SEGMENT', 'Sınıflandırılmamış segment', true)
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
  ('standart açık', 'OPEN'::public.customer_channel), ('horeca', 'OPEN'::public.customer_channel),
  ('otel', 'OPEN'::public.customer_channel), ('standart kapalı', 'CLOSED'::public.customer_channel),
  ('ekomini', 'CLOSED'::public.customer_channel)
) as v(raw_normalized, channel)
join public.channel_definitions d on d.channel = v.channel
on conflict (raw_normalized, valid_from) do nothing;

insert into public.source_contract_versions (
  source_kind, contract_version, header_signature, required_fields, parser_name, parser_version,
  effective_from, status, publication_mode, empty_snapshot_allowed
) values (
  'CUSTOMER_MASTER', 1,
  'Müşteri|Müşteri Adı|Tabela Adı|Satış Temsilcisi Adı|Dist Satış Şefi Adı|Satış Kanalı Tanımı|Müşteri Hacim Segmenti|Müşteri Durumu',
  '["Müşteri","Müşteri Adı","Tabela Adı","Satış Temsilcisi Adı","Dist Satış Şefi Adı","Satış Kanalı Tanımı","Müşteri Hacim Segmenti","Müşteri Durumu"]'::jsonb,
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

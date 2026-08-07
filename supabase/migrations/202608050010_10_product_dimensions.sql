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
  'İşlem Tarihi|Bozulan/Birleştirilen Ürün Kodu|Miktar|Oluşan Ürün Kodu|Miktar',
  '["İşlem Tarihi","Bozulan/Birleştirilen Ürün Kodu","Miktar","Oluşan Ürün Kodu","Miktar"]'::jsonb,
  'package-conversion-v2', '1.0.0', now(), 'ACTIVE', 'UPSERT_VERSIONED', false
)
on conflict (source_kind, contract_version) do nothing;

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
insert into public.warehouses(warehouse_code, display_name) values ('DEFAULT_WAREHOUSE', 'Varsayılan Bayi Deposu') on conflict (warehouse_code) do nothing;

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
values ('CURRENT_STOCK_AVAILABLE', 1, 'Malzeme numarası|Malzeme tanımı|Tahditsiz kullanılabilir', '["Malzeme numarası","Malzeme tanımı","Tahditsiz kullanılabilir"]'::jsonb, 'current-stock-v2', '1.0.0', now(), 'ACTIVE', 'FULL_REPLACE', false)
on conflict (source_kind, contract_version) do nothing;

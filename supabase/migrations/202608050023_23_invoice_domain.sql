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

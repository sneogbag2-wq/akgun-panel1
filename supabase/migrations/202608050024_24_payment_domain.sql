-- Package 08: V3 Anayasası - Payment & Refund (Tahsilat ve Kısmi İade)

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

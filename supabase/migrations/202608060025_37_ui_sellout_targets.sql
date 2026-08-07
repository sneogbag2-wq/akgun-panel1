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

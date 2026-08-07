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
      'chequeNoteRiskRatio', 'cekSenetRiskOrani', 'çekSenetRiskOranı'
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

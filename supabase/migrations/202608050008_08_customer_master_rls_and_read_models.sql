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

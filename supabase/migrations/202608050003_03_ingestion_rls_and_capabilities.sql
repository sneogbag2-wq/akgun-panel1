-- Package 01: fail-closed access controls.  All domain writes are RPC-only.

create or replace function public.has_capability(p_user_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
     and p_user_id = auth.uid()
     and exists (
       select 1
       from public.app_user_capabilities c
       where c.user_id = p_user_id
         and c.capability = p_capability
     );
$$;

revoke all on function public.has_capability(uuid, text) from public, anon;
grant execute on function public.has_capability(uuid, text) to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'app_user_capabilities', 'source_contract_versions', 'source_files',
    'import_batches', 'raw_source_rows', 'source_record_versions',
    'source_record_version_raw_rows', 'rule_versions', 'validation_runs',
    'validation_run_rule_versions', 'data_quality_issues',
    'publication_snapshots', 'publication_snapshot_items',
    'import_state_events', 'import_request_idempotency'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant usage on schema public to authenticated;
grant select on public.source_contract_versions, public.import_batches,
  public.validation_runs, public.data_quality_issues, public.publication_snapshots
to authenticated;

create policy app_user_capabilities_self_audit
on public.app_user_capabilities
for select to authenticated
using (user_id = auth.uid() and public.has_capability(auth.uid(), 'import.audit'));

create policy source_contract_versions_view
on public.source_contract_versions
for select to authenticated
using (public.has_capability(auth.uid(), 'import.view'));

create policy source_contract_versions_audit
on public.source_contract_versions
for select to authenticated
using (public.has_capability(auth.uid(), 'import.audit'));

create policy import_batches_view_own
on public.import_batches
for select to authenticated
using (
  created_by = auth.uid()
  and public.has_capability(auth.uid(), 'import.view')
);

create policy source_files_audit_own_batch
on public.source_files
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1 from public.import_batches b
    where b.source_file_id = source_files.id
      and b.created_by = auth.uid()
  )
);

create policy raw_source_rows_audit_own_batch
on public.raw_source_rows
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1 from public.import_batches b
    where b.id = raw_source_rows.import_batch_id
      and b.created_by = auth.uid()
  )
);

create policy source_record_versions_audit_own_batch
on public.source_record_versions
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1 from public.import_batches b
    where b.id = source_record_versions.import_batch_id
      and b.created_by = auth.uid()
  )
);

create policy source_record_version_raw_rows_audit
on public.source_record_version_raw_rows
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1
    from public.source_record_versions v
    join public.import_batches b on b.id = v.import_batch_id
    where v.id = source_record_version_raw_rows.source_record_version_id
      and b.created_by = auth.uid()
  )
);

create policy rule_versions_audit
on public.rule_versions
for select to authenticated
using (public.has_capability(auth.uid(), 'import.audit'));

create policy validation_runs_view_own_batch
on public.validation_runs
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.view')
  and exists (
    select 1 from public.import_batches b
    where b.id = validation_runs.import_batch_id
      and b.created_by = auth.uid()
  )
);

create policy validation_run_rule_versions_audit
on public.validation_run_rule_versions
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1
    from public.validation_runs r
    join public.import_batches b on b.id = r.import_batch_id
    where r.id = validation_run_rule_versions.validation_run_id
      and b.created_by = auth.uid()
  )
);

create policy data_quality_issues_view_own_batch
on public.data_quality_issues
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.view')
  and exists (
    select 1
    from public.validation_runs r
    join public.import_batches b on b.id = r.import_batch_id
    where r.id = data_quality_issues.validation_run_id
      and b.created_by = auth.uid()
  )
);

create policy publication_snapshots_view
on public.publication_snapshots
for select to authenticated
using (public.has_capability(auth.uid(), 'import.view'));

create policy publication_snapshot_items_audit
on public.publication_snapshot_items
for select to authenticated
using (public.has_capability(auth.uid(), 'import.audit'));

create policy import_state_events_audit_own_batch
on public.import_state_events
for select to authenticated
using (
  public.has_capability(auth.uid(), 'import.audit')
  and exists (
    select 1 from public.import_batches b
    where b.id = import_state_events.import_batch_id
      and b.created_by = auth.uid()
  )
);

create policy import_request_idempotency_self
on public.import_request_idempotency
for select to authenticated
using (
  actor_id = auth.uid()
  and public.has_capability(auth.uid(), 'import.audit')
);

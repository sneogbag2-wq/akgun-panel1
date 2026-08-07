-- Package 01: state-machine, provenance and append-only enforcement.

create or replace function public.prevent_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'IMMUTABLE_RECORD' using errcode = '55000';
end;
$$;

create or replace function public.touch_import_batch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and current_setting('app.import_state_transition', true) is distinct from 'on' then
    raise exception 'DIRECT_STATE_UPDATE_FORBIDDEN' using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prevent_import_batch_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'IMPORT_BATCH_DELETE_FORBIDDEN' using errcode = '55000';
end;
$$;

create or replace function public.allow_validation_run_completion_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('app.import_validation_transition', true) is distinct from 'on' then
    raise exception 'VALIDATION_RUN_IMMUTABLE' using errcode = '55000';
  end if;
  if old.import_batch_id is distinct from new.import_batch_id
     or old.source_contract_version_id is distinct from new.source_contract_version_id
     or old.started_at is distinct from new.started_at
     or old.created_by is distinct from new.created_by
     or old.status <> 'RUNNING'
     or new.status not in ('SUCCEEDED', 'REVIEW_REQUIRED', 'FAILED')
     or new.finished_at is null then
    raise exception 'INVALID_VALIDATION_RUN_UPDATE' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.allow_snapshot_deactivation_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('app.import_publish', true) is distinct from 'on'
     or old.is_active is not true
     or new.is_active is not false
     or old.id is distinct from new.id
     or old.source_kind is distinct from new.source_kind
     or old.scope_key is distinct from new.scope_key
     or old.import_batch_id is distinct from new.import_batch_id
     or old.validation_run_id is distinct from new.validation_run_id
     or old.snapshot_version is distinct from new.snapshot_version
     or old.published_by is distinct from new.published_by
     or old.published_at is distinct from new.published_at
     or old.previous_snapshot_id is distinct from new.previous_snapshot_id
     or old.control_totals is distinct from new.control_totals then
    raise exception 'PUBLICATION_SNAPSHOT_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.is_valid_import_transition(
  p_from public.import_batch_status,
  p_to public.import_batch_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('INITIATED'::public.import_batch_status, 'UPLOADED'::public.import_batch_status),
    ('UPLOADED'::public.import_batch_status, 'HASH_VERIFIED'::public.import_batch_status),
    ('UPLOADED'::public.import_batch_status, 'FAILED'::public.import_batch_status),
    ('HASH_VERIFIED'::public.import_batch_status, 'PARSING'::public.import_batch_status),
    ('HASH_VERIFIED'::public.import_batch_status, 'DUPLICATE'::public.import_batch_status),
    ('PARSING'::public.import_batch_status, 'PARSED'::public.import_batch_status),
    ('PARSING'::public.import_batch_status, 'FAILED'::public.import_batch_status),
    ('PARSED'::public.import_batch_status, 'VALIDATING'::public.import_batch_status),
    ('VALIDATING'::public.import_batch_status, 'VALIDATED'::public.import_batch_status),
    ('VALIDATING'::public.import_batch_status, 'REVIEW_REQUIRED'::public.import_batch_status),
    ('VALIDATING'::public.import_batch_status, 'FAILED'::public.import_batch_status),
    ('REVIEW_REQUIRED'::public.import_batch_status, 'APPROVED'::public.import_batch_status),
    ('REVIEW_REQUIRED'::public.import_batch_status, 'REJECTED'::public.import_batch_status),
    ('VALIDATED'::public.import_batch_status, 'PUBLISHING'::public.import_batch_status),
    ('APPROVED'::public.import_batch_status, 'PUBLISHING'::public.import_batch_status),
    ('PUBLISHING'::public.import_batch_status, 'PUBLISHED'::public.import_batch_status)
  );
$$;

create or replace function public.transition_import_batch(
  p_batch_id uuid,
  p_to public.import_batch_status,
  p_reason_code text,
  p_request_id uuid default gen_random_uuid(),
  p_correlation_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_previous_status public.import_batch_status;
begin
  select * into v_batch
  from public.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_status := v_batch.status;
  if not public.is_valid_import_transition(v_previous_status, p_to) then
    raise exception 'INVALID_IMPORT_STATE_TRANSITION' using errcode = '55000';
  end if;

  perform set_config('app.import_state_transition', 'on', true);
  update public.import_batches
  set status = p_to
  where id = p_batch_id
  returning * into v_batch;

  insert into public.import_state_events (
    import_batch_id, previous_status, new_status, actor_id, reason_code,
    request_id, correlation_id, metadata
  ) values (
    p_batch_id, v_previous_status, p_to, auth.uid(), p_reason_code,
    p_request_id, p_correlation_id, coalesce(p_metadata, '{}'::jsonb)
  );

  return v_batch;
end;
$$;

create trigger import_batches_touch_trigger
before update on public.import_batches
for each row execute function public.touch_import_batch();

create trigger import_batches_no_delete_trigger
before delete on public.import_batches
for each row execute function public.prevent_import_batch_delete();

create trigger source_files_immutable_trigger
before update or delete on public.source_files
for each row execute function public.prevent_immutable_change();

create trigger raw_source_rows_immutable_trigger
before update or delete on public.raw_source_rows
for each row execute function public.prevent_immutable_change();

create trigger source_record_versions_immutable_trigger
before update or delete on public.source_record_versions
for each row execute function public.prevent_immutable_change();

create trigger source_record_version_raw_rows_immutable_trigger
before update or delete on public.source_record_version_raw_rows
for each row execute function public.prevent_immutable_change();

create trigger validation_runs_completion_only_trigger
before update on public.validation_runs
for each row execute function public.allow_validation_run_completion_only();

create trigger validation_runs_no_delete_trigger
before delete on public.validation_runs
for each row execute function public.prevent_immutable_change();

create trigger validation_run_rule_versions_immutable_trigger
before update or delete on public.validation_run_rule_versions
for each row execute function public.prevent_immutable_change();

create trigger data_quality_issues_immutable_trigger
before update or delete on public.data_quality_issues
for each row execute function public.prevent_immutable_change();

create trigger publication_snapshots_immutable_trigger
before update on public.publication_snapshots
for each row execute function public.allow_snapshot_deactivation_only();

create trigger publication_snapshots_no_delete_trigger
before delete on public.publication_snapshots
for each row execute function public.prevent_immutable_change();

create trigger publication_snapshot_items_immutable_trigger
before update or delete on public.publication_snapshot_items
for each row execute function public.prevent_immutable_change();

create trigger import_state_events_immutable_trigger
before update or delete on public.import_state_events
for each row execute function public.prevent_immutable_change();

create trigger import_request_idempotency_immutable_trigger
before update or delete on public.import_request_idempotency
for each row execute function public.prevent_immutable_change();

create trigger source_contract_versions_immutable_trigger
before update or delete on public.source_contract_versions
for each row execute function public.prevent_immutable_change();

create trigger rule_versions_immutable_trigger
before update or delete on public.rule_versions
for each row execute function public.prevent_immutable_change();

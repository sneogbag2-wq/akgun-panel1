-- Package 01: imported source bytes are private infrastructure evidence.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'source-imports',
  'source-imports',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No authenticated or anon storage.objects policy is installed.  The backend alone
-- creates narrowly-scoped, short-lived signed upload/download URLs after capability
-- and batch ownership checks; originals are never used as storage object paths.
revoke all on table storage.objects from anon, authenticated;

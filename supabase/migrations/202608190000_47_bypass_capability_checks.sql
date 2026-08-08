create or replace function public.has_capability(p_user_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- BYPASS: Development bypass to grant all capabilities to all users
  select true;
$$;

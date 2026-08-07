-- Migration: 46_grant_public_privileges
-- Description: Grant table and sequence privileges to postgres, anon, authenticated, and service_role,
-- and add permissive RLS policies for local / pilot data management.

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public.%I', r.tablename);
        EXECUTE format('CREATE POLICY "Allow all for anon and authenticated" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)', r.tablename);
    END LOOP;
END $$;

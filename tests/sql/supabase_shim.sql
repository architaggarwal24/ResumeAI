-- tests/sql/supabase_shim.sql
-- Minimal stand-in for the parts of Supabase the migrations rely on (roles,
-- auth.uid(), auth.jwt(), auth.users, auth.mfa_factors, pgcrypto in the
-- `extensions` schema, Supabase's default grants). Only for running the
-- migration tests against a throwaway local PostgreSQL. NEVER run on Supabase.
--
--   createdb resumeai_test
--   psql -d resumeai_test -f tests/sql/supabase_shim.sql
--   for f in 000_reset 002_secure_share_access 003_security_hardening 004_atomic_caps 005_security_remediation; do
--     psql -d resumeai_test -v ON_ERROR_STOP=1 -f supabase/migrations/$f.sql; done
--   psql -d resumeai_test -f tests/sql/005_security_remediation.test.sql   # every line should read "ok" or show the expected value
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth; CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto SCHEMA extensions;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated;
CREATE TABLE auth.mfa_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, status text);
-- Supabase default: new public functions are executable by anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

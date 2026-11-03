-- supabase/migrations/004_atomic_caps.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic per-owner caps.
--
-- The API routes count rows and then insert. Two parallel requests can both
-- pass the count and both insert, so the caps (200 resumes, 1000 jobs, 100
-- snapshots per resume, 25 share links per resume) could be exceeded — and
-- PostgREST lets a client insert directly, skipping the route's check entirely.
--
-- Fix: a BEFORE INSERT trigger per table takes a transaction-scoped advisory
-- lock keyed on the owner, then counts and inserts under that lock. Concurrent
-- inserts for the same owner are serialised, so the check and the insert are
-- one atomic step. Different owners never wait on each other.
--
-- Violations raise SQLSTATE 23514 (check_violation) with a message starting
-- "limit_reached:", which the API maps to HTTP 409.
--
-- Safe to run more than once. Run after 003_security_hardening.sql.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_row_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_col text    := TG_ARGV[0];        -- column that identifies the owner
  v_cap       integer := TG_ARGV[1]::integer;
  v_owner     uuid;
  v_count     integer;
BEGIN
  EXECUTE format('SELECT ($1).%I', v_owner_col) INTO v_owner USING NEW;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialise inserts for this owner + table until the transaction ends.
  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME || ':' || v_owner::text, 0));

  EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME, v_owner_col)
    INTO v_count USING v_owner;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'limit_reached:%', TG_TABLE_NAME
      USING ERRCODE = 'check_violation', HINT = format('At most %s rows per %s.', v_cap, v_owner_col);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_row_cap() FROM PUBLIC;

DROP TRIGGER IF EXISTS cap_resumes ON public.resumes;
CREATE TRIGGER cap_resumes
  BEFORE INSERT ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_cap('user_id', '200');

DROP TRIGGER IF EXISTS cap_job_applications ON public.job_applications;
CREATE TRIGGER cap_job_applications
  BEFORE INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_cap('user_id', '1000');

DROP TRIGGER IF EXISTS cap_resume_versions ON public.resume_versions;
CREATE TRIGGER cap_resume_versions
  BEFORE INSERT ON public.resume_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_cap('resume_id', '100');

DROP TRIGGER IF EXISTS cap_resume_shares ON public.resume_shares;
CREATE TRIGGER cap_resume_shares
  BEFORE INSERT ON public.resume_shares
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_cap('resume_id', '25');

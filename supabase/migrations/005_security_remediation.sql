-- supabase/migrations/005_security_remediation.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fixes from SECURITY_AUDIT.md (2026-11-03). Run after 004_atomic_caps.sql.
-- Safe to run more than once.
--
-- ⚠ DEPLOY ORDER: run this migration BEFORE deploying the matching app code.
--   The new /api/share, /api/account/delete and rate limiting call the
--   functions defined here. (The app falls back to its in-memory limiter if
--   rate_limit_hit() is missing, but share creation and account deletion need
--   this file.)
--
--   1. Shared rate limits (L3): rate_limit_hit(bucket) — one counter per user
--      and bucket, limits defined here, not by the caller.
--   2. Share creation (Q1, A16): create_share() replaces the client-callable
--      hash_share_password(), which let any account burn database CPU.
--   3. Account deletion (Q3, B2/B9): delete_my_account() removes the login
--      itself; the app data cascades from auth.users.
--   4. Size limits (Q7, A8): CHECK constraints on the text columns 003 missed.
--   5. MFA enforcement (L2, B1): once a user has a verified TOTP factor, their
--      data is reachable only from an aal2 (two-factor) session.
--
-- Note on grants: Supabase grants EXECUTE on new public functions to anon and
-- authenticated by default, so every function below revokes those explicitly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 0. MFA helper ───────────────────────────────────────────────────────────
-- True when the caller has no verified MFA factor, or this session already
-- passed the second factor (JWT claim aal = 'aal2').
-- If the factors table can't be read (it always can on Supabase), it returns
-- true rather than breaking every query; the app-side MFA gate still applies.
CREATE OR REPLACE FUNCTION public.session_meets_mfa()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' THEN
    RETURN true;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors f
    WHERE f.user_id = auth.uid() AND f.status = 'verified'
  );
EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.session_meets_mfa() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_meets_mfa() TO authenticated;

-- ─── 1. Shared rate limits ──────────────────────────────────────────────────
-- Fixed window per (user, bucket): at most one row per bucket per user, so the
-- table can't grow without bound. Limits live in this function so a caller
-- can't pass a bigger limit or a shorter window to reset their own counter.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bucket       text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL,
  PRIMARY KEY (user_id, bucket)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the SECURITY DEFINER function below touches it.
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_bucket text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_now    timestamptz := clock_timestamp();
  v_limit  integer;
  v_window interval;
  v_hits   integer;
  v_start  timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT t.lim, t.win INTO v_limit, v_window
  FROM (VALUES
    ('ai',           20,  interval '1 minute'),
    ('llm_proxy',    30,  interval '1 minute'),
    ('test_conn',     6,  interval '1 minute'),
    ('export',       20,  interval '1 minute'),
    ('write',       120,  interval '1 minute'),
    ('share_create', 20,  interval '1 hour')
  ) AS t(name, lim, win)
  WHERE t.name = p_bucket;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_bucket' USING ERRCODE = '22023';
  END IF;

  -- The upsert takes a row lock, so concurrent hits for one user queue up and
  -- each sees the previous count: the check-and-increment is atomic.
  INSERT INTO public.rate_limits AS r (user_id, bucket, window_start, hits)
  VALUES (v_uid, p_bucket, v_now, 1)
  ON CONFLICT (user_id, bucket) DO UPDATE SET
    window_start = CASE WHEN r.window_start <= v_now - v_window THEN v_now ELSE r.window_start END,
    hits         = CASE WHEN r.window_start <= v_now - v_window THEN 1 ELSE least(r.hits + 1, 1000000) END
  RETURNING hits, window_start INTO v_hits, v_start;

  IF v_hits > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_ms', greatest(1, ceil(extract(epoch FROM (v_start + v_window - v_now)) * 1000))::bigint
    );
  END IF;
  RETURN jsonb_build_object('allowed', true, 'remaining', v_limit - v_hits);
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text) TO authenticated;

-- ─── 2. Share creation ──────────────────────────────────────────────────────
-- hash_share_password() is no longer callable by clients. It stays defined for
-- create_share(), which runs as the function owner.
REVOKE ALL ON FUNCTION public.hash_share_password(text) FROM PUBLIC, anon, authenticated;

-- Validates, throttles (20 per user per hour), checks ownership, generates the
-- slug and hashes the password in one place. Errors:
--   28000 not_authenticated · 42501 mfa_required · P0001 rate_limited:<ms>
--   P0002 not_found · 22023 invalid_password / invalid_expiry
--   23514 limit_reached:resume_shares (from the 004 cap trigger)
CREATE OR REPLACE FUNCTION public.create_share(
  p_resume_id  uuid,
  p_password   text        DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_rl    jsonb;
  v_slug  text;
  v_hash  text;
  v_row   public.resume_shares%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.session_meets_mfa() THEN
    RAISE EXCEPTION 'mfa_required' USING ERRCODE = '42501';
  END IF;

  -- Throttle before any bcrypt work.
  v_rl := public.rate_limit_hit('share_create');
  IF NOT (v_rl ->> 'allowed')::boolean THEN
    RAISE EXCEPTION 'rate_limited:%', v_rl ->> 'retry_after_ms' USING ERRCODE = 'P0001';
  END IF;

  IF p_password IS NOT NULL AND (length(p_password) < 6 OR length(p_password) > 128) THEN
    RAISE EXCEPTION 'invalid_password' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND (p_expires_at <= now() OR p_expires_at > now() + interval '366 days') THEN
    RAISE EXCEPTION 'invalid_expiry' USING ERRCODE = '22023';
  END IF;

  -- This function bypasses RLS, so it checks ownership itself.
  IF NOT EXISTS (SELECT 1 FROM public.resumes WHERE id = p_resume_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Check the 25-per-resume cap BEFORE hashing. Any error rolls back the
  -- rate-limit hit above, so a hash followed by a failing insert would be
  -- unthrottled bcrypt work. Same lock key as the 004 cap trigger.
  PERFORM pg_advisory_xact_lock(hashtextextended('resume_shares:' || p_resume_id::text, 0));
  IF (SELECT count(*) FROM public.resume_shares WHERE resume_id = p_resume_id) >= 25 THEN
    RAISE EXCEPTION 'limit_reached:resume_shares' USING ERRCODE = 'check_violation';
  END IF;

  -- 72 random bits, base64url (12 characters, no padding).
  v_slug := translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_');
  IF p_password IS NOT NULL THEN
    v_hash := public.hash_share_password(p_password);
  END IF;

  INSERT INTO public.resume_shares (resume_id, user_id, slug, password_hash, expires_at)
  VALUES (p_resume_id, v_uid, v_slug, v_hash, p_expires_at)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id, 'slug', v_row.slug, 'view_count', v_row.view_count,
    'expires_at', v_row.expires_at, 'created_at', v_row.created_at,
    'has_password', v_row.password_hash IS NOT NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_share(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_share(uuid, text, timestamptz) TO authenticated;

-- ─── 3. Account deletion ────────────────────────────────────────────────────
-- Deletes the caller's login. public.users references auth.users ON DELETE
-- CASCADE and every app table cascades from public.users or resumes, so all
-- data goes with it. Returns true only if a row was actually deleted.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.session_meets_mfa() THEN
    RAISE EXCEPTION 'mfa_required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.users WHERE id = v_uid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ─── 4. Size limits for direct PostgREST writes ─────────────────────────────
-- 003 covered resumes/resume_versions/job URLs/notification hrefs. These cover
-- the remaining free-text and JSON columns. Limits sit well above what the API
-- accepts. NOT VALID: enforced for new and updated rows only.
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_name_len_chk;
ALTER TABLE public.resumes ADD CONSTRAINT resumes_name_len_chk
  CHECK (length(name) <= 200 AND length(template_id) <= 64) NOT VALID;

ALTER TABLE public.resume_versions DROP CONSTRAINT IF EXISTS resume_versions_label_len_chk;
ALTER TABLE public.resume_versions ADD CONSTRAINT resume_versions_label_len_chk
  CHECK (length(label) <= 200) NOT VALID;

ALTER TABLE public.analyses DROP CONSTRAINT IF EXISTS analyses_size_chk;
ALTER TABLE public.analyses ADD CONSTRAINT analyses_size_chk
  CHECK (octet_length(coalesce(job_description, '')) <= 200000 AND octet_length(result::text) <= 1000000) NOT VALID;

ALTER TABLE public.cover_letters DROP CONSTRAINT IF EXISTS cover_letters_size_chk;
ALTER TABLE public.cover_letters ADD CONSTRAINT cover_letters_size_chk
  CHECK (octet_length(job_description) <= 200000 AND octet_length(content) <= 100000 AND length(tone) <= 64) NOT VALID;

ALTER TABLE public.job_applications DROP CONSTRAINT IF EXISTS job_applications_size_chk;
ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_size_chk
  CHECK (length(company) <= 300 AND length(role) <= 300
         AND length(coalesce(location, '')) <= 300
         AND octet_length(coalesce(notes, '')) <= 50000) NOT VALID;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_size_chk;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_size_chk
  CHECK (length(type) <= 64 AND length(title) <= 300 AND length(body) <= 2000) NOT VALID;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_prefs_len_chk;
ALTER TABLE public.users ADD CONSTRAINT users_prefs_len_chk
  CHECK (length(coalesce(provider, '')) <= 64 AND length(coalesce(model, '')) <= 200
         AND length(coalesce(display_name, '')) <= 200) NOT VALID;

-- ─── 5. MFA enforcement on every user table ─────────────────────────────────
-- RESTRICTIVE policies are ANDed with the existing owner policies. Users
-- without a verified factor are unaffected.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','resumes','analyses','resume_versions','cover_letters',
                           'job_applications','resume_shares','notifications']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS mfa_required ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY mfa_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING ((SELECT public.session_meets_mfa())) WITH CHECK ((SELECT public.session_meets_mfa()))', t);
  END LOOP;
END $$;

-- ============================================================================
-- 003_security_hardening.sql
-- Run in the Supabase SQL editor (or `supabase db push`) AFTER 001 and 002.
-- Idempotent: safe to re-run.
--
-- Why this matters: the Supabase anon key and a user's JWT are public by design,
-- so anyone can call PostgREST / RPC directly and skip every check in the Next.js
-- API routes. Row-level security, grants and database functions are therefore
-- the REAL authorization boundary. This migration closes gaps in that layer.
-- ============================================================================

-- ─── 1. Shares: owner must own the resume being shared ──────────────────────
-- Before: policy `shares_owner` was FOR ALL USING (auth.uid() = user_id) with no
-- WITH CHECK on resume_id. Any authenticated user could INSERT a share row whose
-- resume_id pointed at SOMEONE ELSE'S resume (a FK only checks existence, and
-- FK checks bypass RLS), then read that resume through get_shared_resume().
-- Exploiting it needs the victim's resume UUID (unguessable, but it appears in
-- URLs, logs and screen shares) — so a capability leak became a full read.
DROP POLICY IF EXISTS "shares_owner" ON public.resume_shares;
CREATE POLICY "shares_owner" ON public.resume_shares
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.resumes r
      WHERE r.id = resume_id AND r.user_id = auth.uid()
    )
  );

-- ─── 2. Job applications: linked resume must belong to the same user ────────
DROP POLICY IF EXISTS "job_apps_own" ON public.job_applications;
CREATE POLICY "job_apps_own" ON public.job_applications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      resume_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.resumes r
        WHERE r.id = resume_id AND r.user_id = auth.uid()
      )
    )
  );

-- ─── 3. users: clients may only edit their own preferences ──────────────────
-- Before: `users_own_row` FOR ALL let a user UPDATE any column of their own row
-- through PostgREST — including `tier` ('free' -> 'pro') and `analyses_count`.
-- Nothing gates on `tier` yet, but the first paid feature that does would be
-- bypassable by a single request. Column-level grants fix it at the source.
DROP POLICY IF EXISTS "users_own_row" ON public.users;
CREATE POLICY "users_own_row" ON public.users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE INSERT, UPDATE ON public.users FROM authenticated, anon;
-- The row itself is created by the handle_new_user() trigger (SECURITY DEFINER).
GRANT UPDATE (provider, model, display_name) ON public.users TO authenticated;

-- ─── 4. increment_analyses_count: defined, and keyed on auth.uid() ──────────
-- /api/analyze calls this RPC but no migration defined it, so the counter
-- silently never moved (and a hand-made version that takes a user id argument
-- would let any user bump anyone's counter). The caller identity now comes from
-- the JWT, never from an argument.
DROP FUNCTION IF EXISTS public.increment_analyses_count(uuid);
CREATE OR REPLACE FUNCTION public.increment_analyses_count()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.users SET analyses_count = analyses_count + 1 WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.increment_analyses_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_analyses_count() TO authenticated;

-- ─── 5. SECURITY DEFINER hygiene ────────────────────────────────────────────
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- ─── 6. Share-password brute-force lockout (authoritative) ──────────────────
-- get_shared_resume() is reachable by `anon` straight through PostgREST
-- (POST /rest/v1/rpc/get_shared_resume), so a limiter in the Next.js route
-- can be bypassed. Throttling therefore lives here: after 10 wrong passwords
-- within 15 minutes a slug is locked for 15 minutes, and no bcrypt work is done
-- while locked (which also stops it being used as a CPU-burning endpoint).
-- Trade-off: someone who knows a slug can lock it out for legitimate visitors.
-- That is a deliberate availability-for-confidentiality choice.
CREATE TABLE IF NOT EXISTS public.share_unlock_attempts (
  slug         text PRIMARY KEY,
  failures     integer     NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
ALTER TABLE public.share_unlock_attempts ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the SECURITY DEFINER function below touches it.
REVOKE ALL ON public.share_unlock_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_resume(p_slug text, p_password text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  c_max_failures constant integer  := 10;
  c_window       constant interval := interval '15 minutes';
  v_share    public.resume_shares%ROWTYPE;
  v_resume   RECORD;
  v_attempt  public.share_unlock_attempts%ROWTYPE;
  v_failures integer;
  v_start    timestamptz;
  v_ok       boolean;
  v_has_row  boolean;
BEGIN
  IF p_slug IS NULL OR length(p_slug) > 64 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_share FROM public.resume_shares WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_share.expires_at IS NOT NULL AND v_share.expires_at < now() THEN
    RETURN jsonb_build_object(
      'found', true, 'expired', true,
      'requiresPassword', v_share.password_hash IS NOT NULL, 'unlocked', false
    );
  END IF;

  IF v_share.password_hash IS NOT NULL THEN
    -- No password supplied yet: report that one is needed (never reads content).
    IF p_password IS NULL THEN
      RETURN jsonb_build_object('found', true, 'expired', false, 'requiresPassword', true, 'unlocked', false);
    END IF;

    -- Serialise concurrent guesses on the same slug so parallel requests cannot
    -- all pass the lockout check before the counter moves.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_slug, 0));

    SELECT * INTO v_attempt FROM public.share_unlock_attempts WHERE slug = p_slug;
    v_has_row := FOUND;
    IF v_has_row AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > now() THEN
      RETURN jsonb_build_object(
        'found', true, 'expired', false, 'requiresPassword', true, 'unlocked', false, 'locked', true
      );
    END IF;

    -- Over-long input is rejected without doing bcrypt work (bcrypt only uses 72 bytes anyway).
    v_ok := length(p_password) <= 128 AND crypt(p_password, v_share.password_hash) = v_share.password_hash;

    IF NOT v_ok THEN
      IF v_has_row AND v_attempt.window_start > now() - c_window THEN
        v_failures := v_attempt.failures + 1;
        v_start    := v_attempt.window_start;
      ELSE
        v_failures := 1;
        v_start    := now();
      END IF;

      INSERT INTO public.share_unlock_attempts (slug, failures, window_start, locked_until)
      VALUES (p_slug, v_failures, v_start,
              CASE WHEN v_failures >= c_max_failures THEN now() + c_window ELSE NULL END)
      ON CONFLICT (slug) DO UPDATE
        SET failures     = EXCLUDED.failures,
            window_start = EXCLUDED.window_start,
            locked_until = EXCLUDED.locked_until;

      RETURN jsonb_build_object(
        'found', true, 'expired', false, 'requiresPassword', true, 'unlocked', false,
        'locked', v_failures >= c_max_failures
      );
    END IF;

    -- Correct password: clear the counter.
    DELETE FROM public.share_unlock_attempts WHERE slug = p_slug;
  END IF;

  -- Reached only when no password is required, or the correct one was verified
  -- above. This SELECT bypasses `resumes` RLS via SECURITY DEFINER — it is the
  -- ONLY sanctioned path for an anonymous user to read a resume row.
  SELECT parsed_data, template_id, name INTO v_resume
  FROM public.resumes
  WHERE id = v_share.resume_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  UPDATE public.resume_shares SET view_count = view_count + 1 WHERE slug = p_slug;

  RETURN jsonb_build_object(
    'found', true, 'expired', false,
    'requiresPassword', v_share.password_hash IS NOT NULL,
    'unlocked', true,
    'parsedData', v_resume.parsed_data,
    'templateId', v_resume.template_id,
    'name', v_resume.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_resume(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_resume(text, text) TO anon, authenticated;

-- ─── 7. Defence-in-depth constraints (bypass-proof, unlike route validation) ─
-- NOT VALID: enforced for new/updated rows without failing on existing data.
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_size_chk;
ALTER TABLE public.resumes ADD CONSTRAINT resumes_size_chk
  CHECK (octet_length(parsed_data::text) <= 1000000 AND octet_length(raw_text) <= 400000) NOT VALID;

ALTER TABLE public.resume_versions DROP CONSTRAINT IF EXISTS resume_versions_size_chk;
ALTER TABLE public.resume_versions ADD CONSTRAINT resume_versions_size_chk
  CHECK (octet_length(parsed_data::text) <= 1000000) NOT VALID;

ALTER TABLE public.job_applications DROP CONSTRAINT IF EXISTS job_applications_url_chk;
ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_url_chk
  CHECK (url IS NULL OR (url ~* '^https?://' AND length(url) <= 2048)) NOT VALID;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_href_chk;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_href_chk
  CHECK (href IS NULL OR (left(href, 1) = '/' AND left(href, 2) <> '//' AND position(chr(92) in href) = 0 AND length(href) <= 2048)) NOT VALID;

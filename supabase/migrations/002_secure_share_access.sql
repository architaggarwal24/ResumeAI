-- supabase/migrations/002_secure_share_access.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ResumeAI — Secure public resume sharing
-- Run: supabase db push  (or paste into the Supabase SQL Editor)
--
-- Problems being fixed:
--   1. Anonymous visitors had no legitimate way to read the resume behind a
--      share link — `resumes` RLS only allows auth.uid() = user_id, so the
--      public share page's join silently returned nothing for anyone who
--      wasn't logged in as the owner.
--   2. Password-protected shares sent the full resume AND the raw password
--      hash to the browser (as props to a 'use client' component) before
--      the password was ever checked — visible in page source.
--   3. Password hashing was unsalted SHA-256 using NEXT_PUBLIC_SUPABASE_URL
--      as a "pepper" — but NEXT_PUBLIC_ vars ship to the browser, so it
--      isn't a secret at all.
--
-- Fix: a single SECURITY DEFINER function, get_shared_resume(), is the only
-- way anonymous users read shared resume data. No broad public SELECT
-- policy is added to `resumes`. The previous permissive `shares_public_read`
-- policy on `resume_shares` is dropped below — it's no longer needed (the
-- function bypasses RLS internally via SECURITY DEFINER) and was needlessly
-- exposing password hashes and share metadata to anyone querying the table
-- directly via the REST API, independent of the share page.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Drop the old broad public-read policy on resume_shares ──────────────────
-- Anonymous reads now go exclusively through get_shared_resume() below.
DROP POLICY IF EXISTS "shares_public_read" ON public.resume_shares;

-- ─── Password hashing (bcrypt via pgcrypto) ───────────────────────────────────
-- Called from src/app/api/share/route.ts when creating a share. Replaces
-- unsalted SHA-256 + NEXT_PUBLIC_SUPABASE_URL "pepper" with real bcrypt.
-- Restricted to `authenticated` — only logged-in owners create shares.
-- Cost factor 12 (not pgcrypto's default of 6, which is fast enough to make
-- brute-forcing a leaked hash practical). ~150-250ms per hash on typical
-- hardware — negligible for a "create/unlock a share" flow that isn't a
-- high-frequency login endpoint.
CREATE OR REPLACE FUNCTION public.hash_share_password(p_password text)
RETURNS text
LANGUAGE sql
SET search_path = public, extensions, pg_temp
AS $$
  SELECT crypt(p_password, gen_salt('bf', 12));
$$;

REVOKE ALL ON FUNCTION public.hash_share_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hash_share_password(text) TO authenticated;

-- ─── The only way anonymous users read shared resume data ────────────────────
-- Call with p_password = NULL first (initial page load) to learn whether the
-- slug exists, is expired, and whether it needs a password — without ever
-- touching resume content or the password hash. Call again with the
-- submitted password to actually unlock it. Always returns the same jsonb
-- shape so the caller doesn't need to distinguish "not found" from "wrong
-- password" from the response structure alone:
--   { found, expired, requiresPassword, unlocked, parsedData?, templateId?, name? }
-- parsedData/templateId/name are present only when unlocked = true.
CREATE OR REPLACE FUNCTION public.get_shared_resume(p_slug text, p_password text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_share  public.resume_shares%ROWTYPE;
  v_resume RECORD;
BEGIN
  SELECT * INTO v_share
  FROM public.resume_shares
  WHERE slug = p_slug;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_share.expires_at IS NOT NULL AND v_share.expires_at < now() THEN
    RETURN jsonb_build_object(
      'found', true,
      'expired', true,
      'requiresPassword', v_share.password_hash IS NOT NULL,
      'unlocked', false
    );
  END IF;

  IF v_share.password_hash IS NOT NULL THEN
    -- No password supplied yet, or it doesn't match — never fall through to
    -- reading resume content in either case.
    IF p_password IS NULL OR crypt(p_password, v_share.password_hash) <> v_share.password_hash THEN
      RETURN jsonb_build_object(
        'found', true,
        'expired', false,
        'requiresPassword', true,
        'unlocked', false
      );
    END IF;
  END IF;

  -- Reached only when no password is required, or the correct one was just
  -- verified above. This SELECT bypasses `resumes` RLS via SECURITY DEFINER —
  -- it is the ONLY sanctioned path for an anonymous user to read a resume row.
  SELECT parsed_data, template_id, name INTO v_resume
  FROM public.resumes
  WHERE id = v_share.resume_id;

  IF NOT FOUND THEN
    -- Underlying resume was deleted but the share row remains — treat as gone.
    RETURN jsonb_build_object('found', false);
  END IF;

  UPDATE public.resume_shares
  SET view_count = view_count + 1
  WHERE slug = p_slug;

  RETURN jsonb_build_object(
    'found', true,
    'expired', false,
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

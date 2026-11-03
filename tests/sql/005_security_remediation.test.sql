-- tests/sql/005_security_remediation.test.sql
-- Run against a throwaway local database prepared as described in supabase_shim.sql.
-- Expected: every check prints "ok …"; counts are shown next to their labels.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','a@x'),('bbbbbbbb-0000-0000-0000-000000000002','b@x');
INSERT INTO public.resumes (id, user_id, name) VALUES ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','A cv'),('bbbbbbbb-1111-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','B cv');
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;  -- Supabase default table grants (003 then narrows users)
REVOKE INSERT, UPDATE ON public.users FROM authenticated, anon; GRANT UPDATE (provider, model, display_name) ON public.users TO authenticated;
REVOKE ALL ON public.rate_limits, public.share_unlock_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION pg_temp.expect_err(p_sql text, p_role text, p_sub text, p_aal text, p_like text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub,''), true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'aal', p_aal)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  EXECUTE p_sql;
  RESET ROLE;
  RETURN 'FAIL (no error): ' || p_sql;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  IF SQLERRM LIKE p_like THEN RETURN 'ok   ' || p_like; END IF;
  RETURN 'FAIL got [' || SQLSTATE || '] ' || SQLERRM || ' for ' || p_sql;
END $f$;
CREATE OR REPLACE FUNCTION pg_temp.as_val(p_sql text, p_role text, p_sub text, p_aal text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub,''), true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'aal', p_aal)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  EXECUTE p_sql INTO v;
  RESET ROLE;
  RETURN v;
END $f$;

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set AR '''aaaaaaaa-1111-0000-0000-000000000001'''
\set BR '''bbbbbbbb-1111-0000-0000-000000000002'''
BEGIN;
SELECT pg_temp.expect_err($$SELECT public.hash_share_password('x')$$, 'authenticated', :A, 'aal1', '%permission denied%') AS q1_hash_revoked;
SELECT pg_temp.expect_err($$SELECT public.hash_share_password('x')$$, 'anon', NULL, NULL, '%permission denied%') AS q1_hash_revoked_anon;
SELECT pg_temp.expect_err($$SELECT public.create_share('bbbbbbbb-1111-0000-0000-000000000002')$$, 'authenticated', :A, 'aal1', 'not_found') AS q1_other_users_resume;
SELECT pg_temp.expect_err($$SELECT public.create_share('aaaaaaaa-1111-0000-0000-000000000001','abc')$$, 'authenticated', :A, 'aal1', 'invalid_password') AS q1_short_pw;
SELECT pg_temp.expect_err($$SELECT public.create_share('aaaaaaaa-1111-0000-0000-000000000001',NULL, now() - interval '1 day')$$, 'authenticated', :A, 'aal1', 'invalid_expiry') AS q1_past_expiry;
SELECT pg_temp.expect_err($$SELECT public.create_share('aaaaaaaa-1111-0000-0000-000000000001')$$, 'anon', NULL, NULL, '%permission denied%') AS q1_anon_cannot;
SELECT pg_temp.as_val($$SELECT (public.create_share('aaaaaaaa-1111-0000-0000-000000000001','secret12', now() + interval '7 days'))::text$$, 'authenticated', :A, 'aal1') AS q1_created;
SELECT slug, length(slug) AS slug_len, password_hash LIKE '$2a$12$%' AS bcrypt12, user_id = :A AS owner_ok FROM public.resume_shares;
SELECT (public.get_shared_resume(slug, 'secret12') ->> 'unlocked') AS anon_unlock_still_works FROM public.resume_shares LIMIT 1;
COMMIT;
-- throttle: failed calls roll back their hit, so only successes count. 1 success so far.
DO $$ BEGIN FOR i IN 1..19 LOOP PERFORM pg_temp.as_val($q$SELECT (public.create_share('aaaaaaaa-1111-0000-0000-000000000001'))->>'slug'$q$, 'authenticated', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal1'); END LOOP; END $$;
SELECT count(*) AS shares_after_20 FROM public.resume_shares;
SELECT pg_temp.expect_err($$SELECT public.create_share('aaaaaaaa-1111-0000-0000-000000000001')$$, 'authenticated', :A, 'aal1', 'rate_limited:%') AS q1_21st_throttled;
SELECT hits AS hits_stay_at_20 FROM public.rate_limits WHERE bucket='share_create';
-- cap is checked before hashing: fill to 25 (reset throttle as admin), then a password share must fail fast
DELETE FROM public.rate_limits;
DO $$ BEGIN FOR i IN 1..5 LOOP PERFORM pg_temp.as_val($q$SELECT (public.create_share('aaaaaaaa-1111-0000-0000-000000000001'))->>'slug'$q$, 'authenticated', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal1'); END LOOP; END $$;
SELECT count(*) AS shares_at_cap FROM public.resume_shares;
\timing on
SELECT pg_temp.expect_err($$SELECT public.create_share('aaaaaaaa-1111-0000-0000-000000000001','secret12')$$, 'authenticated', :A, 'aal1', 'limit_reached:resume_shares') AS q1_cap_before_hash;
\timing off
DELETE FROM public.resume_shares WHERE password_hash IS NULL;
BEGIN;
SELECT pg_temp.expect_err($$SELECT public.rate_limit_hit('bogus')$$, 'authenticated', :A, 'aal1', 'unknown_bucket') AS l3_unknown_bucket;
SELECT pg_temp.expect_err($$SELECT public.rate_limit_hit('ai')$$, 'anon', NULL, NULL, '%permission denied%') AS l3_anon_denied;
SELECT pg_temp.expect_err($$SELECT * FROM public.rate_limits$$, 'authenticated', :A, 'aal1', '%permission denied%') AS l3_table_private;
SELECT string_agg((public.rate_limit_hit('test_conn') ->> 'allowed'), ',') AS l3_six_then_block FROM generate_series(1,7) WHERE pg_temp.as_val('SELECT 1', 'authenticated', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal1') = '1';
ROLLBACK;
-- Q7 size limits
BEGIN;
SELECT pg_temp.expect_err($$INSERT INTO public.job_applications (user_id, company, role, notes) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','c','r', repeat('x', 60000))$$, 'authenticated', :A, 'aal1', '%job_applications_size_chk%') AS q7_notes;
SELECT pg_temp.expect_err($$INSERT INTO public.cover_letters (resume_id, content) VALUES ('aaaaaaaa-1111-0000-0000-000000000001', repeat('x', 200000))$$, 'authenticated', :A, 'aal1', '%cover_letters_size_chk%') AS q7_cover;
SELECT pg_temp.as_val($$INSERT INTO public.job_applications (user_id, company, role, notes) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','c','r','fine') RETURNING 'insert ok'$$, 'authenticated', :A, 'aal1') AS q7_normal_ok;
ROLLBACK;
-- L2 MFA
BEGIN;
SELECT pg_temp.as_val($$SELECT count(*)::text FROM public.resumes$$, 'authenticated', :A, 'aal1') AS mfa_none_aal1_sees;
INSERT INTO auth.mfa_factors (user_id, status) VALUES (:A, 'verified');
SELECT pg_temp.as_val($$SELECT count(*)::text FROM public.resumes$$, 'authenticated', :A, 'aal1') AS mfa_enrolled_aal1_sees;
SELECT pg_temp.as_val($$SELECT count(*)::text FROM public.resumes$$, 'authenticated', :A, 'aal2') AS mfa_enrolled_aal2_sees;
SELECT pg_temp.expect_err($$INSERT INTO public.resumes (user_id) VALUES ('aaaaaaaa-0000-0000-0000-000000000001')$$, 'authenticated', :A, 'aal1', '%row-level security%') AS mfa_aal1_insert_blocked;
SELECT pg_temp.expect_err($$SELECT public.delete_my_account()$$, 'authenticated', :A, 'aal1', 'mfa_required') AS mfa_delete_needs_aal2;
SELECT pg_temp.as_val($$SELECT count(*)::text FROM public.resumes$$, 'authenticated', 'bbbbbbbb-0000-0000-0000-000000000002', 'aal1') AS other_user_unaffected;
ROLLBACK;
-- Q3 account deletion
BEGIN;
SELECT pg_temp.expect_err($$SELECT public.delete_my_account()$$, 'anon', NULL, NULL, '%permission denied%') AS q3_anon_denied;
SELECT pg_temp.as_val($$SELECT public.delete_my_account()::text$$, 'authenticated', :A, 'aal1') AS q3_deleted;
SELECT (SELECT count(*) FROM auth.users WHERE id = :A) AS a_auth_left, (SELECT count(*) FROM public.users WHERE id = :A) AS a_profile_left,
       (SELECT count(*) FROM public.resumes WHERE user_id = :A) AS a_resumes_left, (SELECT count(*) FROM public.resume_shares) AS shares_left,
       (SELECT count(*) FROM public.rate_limits) AS ratelimit_rows_left, (SELECT count(*) FROM auth.users) AS users_total;
SELECT pg_temp.as_val($$SELECT public.delete_my_account()::text$$, 'authenticated', :A, 'aal1') AS q3_second_call_false;
ROLLBACK;

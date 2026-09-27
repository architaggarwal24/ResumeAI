-- supabase/migrations/001_initial.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ResumeAI — Initial Schema
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL UNIQUE,
  tier         TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  provider     TEXT,   -- last used LLM provider (never store the key)
  model        TEXT,   -- last used model
  analyses_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Resumes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resumes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'Untitled Resume',
  raw_text     TEXT NOT NULL DEFAULT '',
  parsed_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_id  TEXT NOT NULL DEFAULT 'classic',
  ats_score    NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Analyses ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analyses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id       UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  job_description TEXT,
  score           NUMERIC NOT NULL DEFAULT 0,
  result          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Cover Letters ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cover_letters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id       UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  job_description TEXT NOT NULL DEFAULT '',
  tone            TEXT NOT NULL DEFAULT 'professional',
  content         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at   BEFORE UPDATE ON public.users   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER resumes_updated_at BEFORE UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Auto-create user row on signup ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "users_own_row" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Resumes: own resumes only
CREATE POLICY "resumes_own" ON public.resumes
  FOR ALL USING (auth.uid() = user_id);

-- Analyses: only via owned resumes
CREATE POLICY "analyses_own" ON public.analyses
  FOR ALL USING (
    resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid())
  );

-- Cover letters: only via owned resumes
CREATE POLICY "cover_letters_own" ON public.cover_letters
  FOR ALL USING (
    resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid())
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS resumes_user_id_idx      ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS analyses_resume_id_idx   ON public.analyses(resume_id);
CREATE INDEX IF NOT EXISTS cover_letters_resume_idx ON public.cover_letters(resume_id);

-- ─── Resume Versions (Milestone 10) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resume_versions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id    UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT 'Manual save',
  parsed_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
  ats_score    NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS resume_versions_resume_id_idx ON public.resume_versions(resume_id);

ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions_own" ON public.resume_versions
  FOR ALL USING (
    resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid())
  );

-- ─── Job Applications (Milestone 12) ─────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
  'saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.job_applications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  resume_id   UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  company     TEXT NOT NULL,
  role        TEXT NOT NULL,
  url         TEXT,
  status      job_status NOT NULL DEFAULT 'saved',
  notes       TEXT,
  salary_min  INTEGER,
  salary_max  INTEGER,
  location    TEXT,
  applied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_apps_user_id_idx    ON public.job_applications(user_id);
CREATE INDEX IF NOT EXISTS job_apps_resume_id_idx  ON public.job_applications(resume_id);
CREATE INDEX IF NOT EXISTS job_apps_status_idx     ON public.job_applications(status);

CREATE TRIGGER job_apps_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_apps_own" ON public.job_applications
  FOR ALL USING (auth.uid() = user_id);

-- ─── Resume Shares (M19) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resume_shares (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id     UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  view_count    INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS resume_shares_slug_idx      ON public.resume_shares(slug);
CREATE INDEX IF NOT EXISTS resume_shares_resume_id_idx ON public.resume_shares(resume_id);

ALTER TABLE public.resume_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shares
CREATE POLICY "shares_owner" ON public.resume_shares
  FOR ALL USING (auth.uid() = user_id);

-- Public can read shares by slug (for the public share page)
CREATE POLICY "shares_public_read" ON public.resume_shares
  FOR SELECT USING (true);

-- ─── Notifications (M21) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  href        TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx    ON public.notifications(user_id, read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- ─── Settings additions ───────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name TEXT;

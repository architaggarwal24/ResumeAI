<!-- README.md -->
# ResumeAI

AI-powered resume intelligence platform: score your resume against a job description, tailor it, generate a cover letter, and prep for the interview — all with your own API key, so nothing you write ever touches a third-party account you don't control.

## Features

- **ATS scoring & analysis** — section-by-section scoring, a recruiter-style verdict, missing keywords, and concrete fixes.
- **Resume editor** — inline editing with an AI coach that proposes specific, one-click edits grounded in your actual resume content.
- **Tailoring** — rewrite a resume against a specific job description without inventing experience you don't have.
- **Cover letters** — generated from your resume and the target job in one pass.
- **Interview prep & mock interviews** — role-specific questions plus an AI-debriefed mock interview.
- **LinkedIn import** — pull a public profile (or paste the text) straight into a structured resume.
- **Multiple templates** — Classic, Modern, Minimal, and Executive, exported as PDF, DOCX, or LaTeX (a `.tex` source file ready to compile or drop into Overleaf).
- **Public share links** — share a read-only, optionally password-protected link to a specific resume version.
- **Version history, job tracking, analytics dashboard, and a command palette (⌘K)** for getting around quickly.
- **Bring your own key (BYOK)** — Anthropic, OpenAI, Gemini, OpenRouter, or NVIDIA NIM. Keys are typed into the browser and held in `sessionStorage` only. Requests pass through this app's own API routes to reach your chosen provider, but the key is never stored or logged.

## Tech stack

This is a **Next.js 16 full-stack application** — there is no separate Express server. The Next.js App Router's API routes (`src/app/api/**/route.ts`) *are* the backend; they run server-side, talk to Supabase, and proxy calls to whichever LLM provider you've configured.

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, TypeScript, Tailwind CSS 4 |
| State | Zustand |
| Backend | Next.js Route Handlers (no separate server) |
| Database & Auth | Supabase (Postgres, Row-Level Security, Supabase Auth) |
| AI providers | Anthropic, OpenAI, Gemini, OpenRouter, NVIDIA NIM (BYOK, client-supplied) |
| Deployment | Vercel or Netlify (config included for both) |

## Getting started

### Prerequisites

- Node.js **20.9 or newer** (`node -v` to check)
- A free [Supabase](https://supabase.com) project
- An API key from at least one supported AI provider — you'll enter this in the app itself, not in an env file

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/ResumeAI.git
cd ResumeAI
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the SQL Editor and run the migrations in order:
   - `supabase/migrations/001_initial.sql` — core schema, tables, and RLS policies
   - `supabase/migrations/002_secure_share_access.sql` — bcrypt-backed password hashing and the `SECURITY DEFINER` function that powers public share links
3. In Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (and your production URL, once deployed) to the allowed redirect URLs.

`supabase/migrations/000_reset.sql` wipes and recreates everything from scratch — only run it if you want to start over.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the three values from your Supabase project's **Settings → API** page:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

No AI provider keys go in this file — see [Bringing your own key](#bringing-your-own-key) below.

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and you're in.

## Usage

1. **Sign up / log in** — handled by Supabase Auth.
2. **Add a key** — Settings → AI Provider & API Keys, pick a provider, paste your key. It's validated with a live test call and stored in `sessionStorage` for the rest of your browser session.
3. **Upload a resume** — PDF, or paste text, or import from LinkedIn.
4. **Score it** — the Score tab breaks it down section by section against ATS and recruiter-readability criteria.
5. **Tailor, generate a cover letter, or prep for an interview** — each of these lives in its own tab once a resume is open.
6. **Share it** — the Share panel gives you a public link, optionally gated by a password, with a live view counter.

### Bringing your own key

This app never stores or proxies your AI provider credentials server-side beyond the single request needed to fulfil an action — no server-side database column holds them, and they never appear in logs. They live in your browser's `sessionStorage`, which is cleared the moment you close the tab. See `src/lib/llm/client.ts` for the full provider/model configuration.

## Project structure

```
src/
├── app/
│   ├── (app)/              # authenticated app shell — dashboard, editor, jobs, settings, etc.
│   ├── (auth)/              # login / signup
│   ├── api/                  # route handlers — the "backend"
│   └── s/[slug]/             # public resume share pages
├── components/              # UI components, grouped by feature
├── lib/
│   ├── llm/                     # provider config + the shared callLLM() client
│   ├── supabase/               # Supabase client factories (browser, server, middleware)
│   ├── templates/              # resume HTML rendering for each template
│   └── pdf/                      # PDF text extraction (extract.ts) + PDF export (generate.tsx)
├── store/                       # Zustand store (resume state, BYOK credentials)
└── proxy.ts                     # Next.js 16 middleware — auth-gates the app routes

supabase/migrations/           # SQL schema, RLS policies, and the share-link security function
```

## Deployment

### Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket) if it isn't already there.
2. Go to [vercel.com/new](https://vercel.com/new), sign in, and import the repo. Next.js is auto-detected — no build settings to change.
3. Before the first deploy, add these three Environment Variables (Project Settings → Environment Variables, or the import screen):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
   ```
   `NEXT_PUBLIC_APP_URL` should be the URL Vercel is about to give you (or your custom domain, once you have one) — a few server routes call themselves internally and need this to know their own address.
4. Click **Deploy**.
5. In your Supabase project: **Authentication → URL Configuration → Redirect URLs**, add the Vercel URL from step 3. Skipping this makes login fail in production while working fine locally.
6. If you add a custom domain later, update both `NEXT_PUBLIC_APP_URL` (redeploy after changing it) and the Supabase redirect URL to match.

### Netlify

`netlify.toml` is already configured (Node 20 pin, build command) — import the repo at [app.netlify.com/start](https://app.netlify.com/start), add the same three environment variables above (with `NEXT_PUBLIC_APP_URL` set to your `.netlify.app` URL), and deploy. Same Supabase redirect URL step as above.

### A note on function timeouts

Every route that calls an LLM sets `export const maxDuration = 60` — Vercel's Hobby plan defaults new Serverless Functions to a 10-second timeout, which a real LLM call (or a scoring pass that chains two calls) can easily exceed. 60 seconds is the maximum Hobby allows; if you're using slower reasoning models heavily, Vercel Pro (up to 300s) gives more headroom.

## Security notes

- Every API route that touches user data or calls an LLM checks for an authenticated Supabase session first.
- Public share links are served through a single `SECURITY DEFINER` Postgres function, not a broad RLS policy — password verification happens inside Postgres via bcrypt, and the password hash never leaves the database.
- All user-generated resume content is HTML-escaped before being rendered into exported documents or share pages.

## Contributing

Issues and pull requests are welcome. For anything non-trivial, please open an issue first to discuss what you'd like to change.

## License

MIT — see [LICENSE](./LICENSE).

## About

Built by **Archit Aggarwal**.

- Portfolio: [architaggarwal24.github.io](https://architaggarwal24.github.io)
- LinkedIn: [linkedin.com/in/architaggarwal24](https://www.linkedin.com/in/architaggarwal24)

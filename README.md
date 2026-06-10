# ResumeAI

An AI-powered resume optimization platform that helps users create, analyze, improve, score, and export professional resumes while maximizing ATS compatibility.

## Overview

ResumeAI helps job seekers build stronger resumes using AI-assisted suggestions, ATS analysis, resume scoring, cover letter generation, and professional templates.

The platform focuses on helping candidates increase interview conversion rates by creating resumes optimized for modern Applicant Tracking Systems (ATS).

## Features

### Resume Builder

* Create resumes from scratch
* Structured resume editor
* Multiple resume sections
* Real-time updates

### ATS Analysis

* ATS compatibility scoring
* Keyword analysis
* Missing skill detection
* Improvement suggestions

### AI Resume Enhancement

* Rewrite bullet points
* Improve achievements
* Optimize professional summaries
* Better action-oriented content

### Cover Letter Generator

* AI-generated cover letters
* Job-specific customization
* Professional formatting

### Resume Scoring

* Overall resume score
* Section-level feedback
* Strength and weakness analysis

### Export Options

* PDF export
* DOCX export
* Professional formatting

### User Management

* Authentication
* Secure resume storage
* Cloud persistence with Supabase

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Next.js API Routes

### Database

* Supabase

### AI Layer

* LLM-powered resume analysis
* Prompt engineering workflows

### State Management

* Zustand

## Project Structure

```text
src/
├── app/
│   ├── api/
│   ├── dashboard/
│   ├── upload/
│   └── resume/
│
├── components/
│   ├── resume/
│   ├── layout/
│   └── ui/
│
├── lib/
│   ├── llm/
│   ├── pdf/
│   ├── templates/
│   └── supabase/
│
└── store/
```

## Installation

### Clone Repository

```bash
git clone https://github.com/architaggarwal24/ResumeAI.git
cd ResumeAI
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create:

```bash
.env.local
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

## Database Setup

Run Supabase migrations:

```sql
supabase/migrations/001_initial.sql
```

or

```bash
supabase db push
```

## Running Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build For Production

```bash
npm run build
npm run start
```

## Core Workflow

1. Upload resume
2. Extract content
3. Analyze ATS compatibility
4. Generate AI recommendations
5. Improve resume sections
6. Create cover letter
7. Export final version

## Ideal Users

* Students
* Fresh graduates
* Career switchers
* Software engineers
* Product managers
* Experienced professionals

## Future Enhancements

* LinkedIn profile import
* Job description matching
* Interview preparation assistant
* Resume version management
* Recruiter insights dashboard

## Author

Archit Aggarwal

## License

MIT License

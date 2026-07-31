# Resumora AI

Resumora is a truth-preserving resume and CV workspace. Phase 1 provides a structured resume editor, five ATS-safe templates, explainable readiness checks, PDF/DOCX export, PDF/DOCX import, version snapshots, optional Supabase sync, and a guarded DeepSeek rewriting endpoint.

## Architecture

```text
apps/web       Next.js 16 frontend → Vercel
apps/api       Fastify API → Render
packages/domain Shared resume schema, scoring rules, fixtures, tests
supabase       Postgres schema and Row Level Security policies
Cloudflare R2  Private source documents via short-lived signed URLs
DeepSeek V4    Truth-preserving writing assistance through the backend only
```

The editor stores content as validated structured data. Templates only control presentation, so changing a design cannot change document reading order. PDF output uses the browser's print-quality A4 renderer and DOCX output contains native text and paragraph structures.

## Run locally

Requirements: Node.js 22 or newer.

```bash
cp .env.example .env
npm install
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/health`

Without credentials, the studio works in local mode with browser autosave, version snapshots, live scoring, template switching, and exports. Configure the services below to enable cloud sync, imports, private storage, authentication, and AI.

## Configure Supabase

1. Create a Supabase project.
2. Run [`supabase/migrations/202607310001_phase_one.sql`](./supabase/migrations/202607310001_phase_one.sql) in the SQL editor.
3. Enable Email OTP authentication and add local/Vercel redirect URLs.
4. Set the public Supabase URL and publishable key in Vercel.
5. Set the URL, publishable key, and secret key in Render.

All exposed tables have Row Level Security enabled. The backend validates the caller's Supabase access token before using its secret-key server connection.

## Configure Cloudflare R2

Create a private `resumora-ai` bucket and an R2 API token scoped to that bucket. Add the explicit S3 endpoint, account ID, access key, secret, and bucket name to Render. Configure bucket CORS for the Vercel production origin before enabling direct browser uploads.

Object keys are isolated under `users/{userId}/...`; generated upload URLs expire after ten minutes and include an enforced content type.

## Configure DeepSeek

Add `DEEPSEEK_API_KEY` to Render. The default model is `deepseek-v4-pro`, DeepSeek's flagship API model as of July 31, 2026. It remains configurable through `DEEPSEEK_MODEL` for future model upgrades.

AI calls are server-side and use structured JSON output. The system prompt prohibits invented skills, employers, qualifications, metrics, or outcomes. Suggestions appear as user-approved diffs and never overwrite original content automatically.

## Deploy

### Vercel

Import the repository as a monorepo project and set the project root to `apps/web`. Add:

```text
NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

### Render

The repository includes [`render.yaml`](./render.yaml). Create a Blueprint from the repository, set all secrets, and set `WEB_ORIGIN` to the exact Vercel origin. The API binds to Render's `PORT` on `0.0.0.0` and exposes `/health`. Resumora uses Supabase's current publishable/secret key pair, while retaining legacy anon/service-role aliases in code for backwards compatibility.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Product roadmap

### Phase 1 — Excellent resume foundation

- Structured, autosaving editor and semantic document model
- Five constrained ATS-safe templates
- PDF, DOCX, and PDF/DOCX/TXT import paths
- Three-part, explainable readiness analysis
- Immutable version snapshots
- Supabase authentication and cloud sync
- Private R2 storage boundary
- Truth-preserving DeepSeek rewriting boundary

### Phase 2 — Best-in-class AI tailoring

- Career Vault with reusable evidence, achievements, skills, and metrics
- Base resume → role-specific resume variants
- Job-description parser separating required and preferred qualifications
- Independent Machine Readability, Job Match, and Recruiter Quality scores
- Keyword, semantic, seniority, recency, and evidence analysis
- Claim Ledger linking every AI proposal to verified career evidence
- Bullet, profile, title, and cover-letter assistance
- Export round-trip parsing to compare PDF/DOCX extraction with source data
- One-click fixes that always show an editable diff

### Phase 3 — Complete job-search workspace

- Saved jobs and an application kanban tracker
- Tailored resume, cover letter, notes, and status stored per application
- Browser extension for capturing job descriptions
- Recruiter/mentor collaboration, comments, and approval history
- Interview preparation based on the resume, job, and verified STAR stories
- LinkedIn/profile consistency checks
- Multilingual documents, regional conventions, and RTL templates
- Mobile-first review and quick edits

### Phase 4 — Career intelligence moat

- Career-history retrieval across old resumes, reviews, projects, and notes
- Role and skill taxonomy with personalized gap analysis
- Career paths, learning plans, and interview coaching
- Privacy-safe outcome tracking to calibrate recommendations against interviews
- Regression corpus for Workday, Greenhouse, Lever, and other parser patterns
- Portfolio and personal-site generation from the same Career Vault
- Organization workspaces for universities, career coaches, and outplacement teams

Resumora will continue to avoid deceptive “official ATS score” claims and autonomous mass auto-apply. The product optimizes for truthful fit, document readability, and higher-quality applications.

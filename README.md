# Resumora AI

Resumora is a truth-preserving resume, CV, application, and career-intelligence workspace. Phase 4 connects verified career history to explainable role readiness, evidence gaps, adjacent paths, learning plans, private outcomes, memory retrieval, interview coaching, consent-based portfolios, and scoped organization support.

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

Without credentials, the editor and deterministic job-match engine work in local mode with browser autosave, Career Vault storage, version snapshots, live scoring, template switching, and exports. Configure the services below to enable cloud sync, imports, private storage, authentication, and DeepSeek proposals.

## Configure Supabase

1. Create a Supabase project.
2. Run the migrations in order:
   - [`supabase/migrations/202607310001_phase_one.sql`](./supabase/migrations/202607310001_phase_one.sql)
   - [`supabase/migrations/202607310002_phase_two.sql`](./supabase/migrations/202607310002_phase_two.sql)
   - [`supabase/migrations/202608010001_phase_three.sql`](./supabase/migrations/202608010001_phase_three.sql)
   - [`supabase/migrations/202608010002_phase_three_collaboration.sql`](./supabase/migrations/202608010002_phase_three_collaboration.sql)
   - [`supabase/migrations/202608010003_phase_four_career_intelligence.sql`](./supabase/migrations/202608010003_phase_four_career_intelligence.sql)
   - [`supabase/migrations/202608010004_phase_four_publishing_organizations.sql`](./supabase/migrations/202608010004_phase_four_publishing_organizations.sql)
   - [`supabase/migrations/202608010005_free_tier_maintenance.sql`](./supabase/migrations/202608010005_free_tier_maintenance.sql)
3. Enable Email OTP authentication and add local/Vercel redirect URLs.
4. Set the public Supabase URL and publishable key in Vercel.
5. Set the URL, publishable key, and secret key in Render.

All exposed tables have Row Level Security enabled. The backend validates the caller's Supabase access token before using its secret-key server connection.

## Configure Cloudflare R2

Create a private `resumora-ai` bucket and an R2 API token scoped to that bucket. Add the explicit S3 endpoint, account ID, access key, secret, and bucket name to Render. Configure bucket CORS for the Vercel production origin before enabling direct browser uploads.

Raw import keys are isolated under `imports/users/{userId}/...`; generated upload URLs expire after ten minutes and include an enforced content type. Add an R2 object lifecycle rule for the `imports/` prefix that expires objects after 60 days. The API's daily cleanup also covers the legacy `users/{userId}/imports/...` layout.

## Configure DeepSeek

Add `DEEPSEEK_API_KEY` to Render. The default model is `deepseek-v4-pro`, DeepSeek's flagship API model as of July 31, 2026. It remains configurable through `DEEPSEEK_MODEL` for future model upgrades.

AI calls are server-side and use structured JSON output. The system prompt prohibits invented skills, employers, qualifications, metrics, or outcomes. Job descriptions are treated as untrusted quoted data. Suggestions appear as user-approved diffs, cite Career Vault evidence IDs, and never overwrite original content automatically.

## Deploy

### Vercel

Import the repository as a monorepo project and set the project root to `apps/web`. Add:

```text
NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

### Render

The repository includes [`render.yaml`](./render.yaml) configured for Render's Free plan. Create a Blueprint from the repository, set all secrets, and set `WEB_ORIGIN` to the exact Vercel origin. Generate a strong `CRON_SECRET` (at least 32 random bytes) and add it only to Render and the cron provider. The API binds to Render's `PORT` on `0.0.0.0` and exposes `/health`. Resumora uses Supabase's current publishable/secret key pair, while retaining legacy anon/service-role aliases in code for backwards compatibility.

The protected `GET /internal/cron/keepalive` endpoint performs one tiny Supabase liveness toggle on every call. At most once every 24 hours it also runs the 60-day retention pass, avoiding unnecessary R2 listing operations. It deletes only disposable database history and raw R2 imports; primary resumes, applications, portfolios, outcomes, and organization records remain intact. Configure the cron request with `Authorization: Bearer <CRON_SECRET>` and never put the secret in a URL. `RETENTION_DAYS` defaults to `60` and is constrained to 30–365 days.

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
- Base resume → role-specific resume variants with source lineage
- DeepSeek job parser with a deterministic fallback and required/preferred separation
- Independent Machine Readability, Job Match, Recruiter Quality, keyword, hard-skill, evidence, and experience signals
- Claim Ledger linking every AI proposal to verified career evidence
- Headline, profile, bullet, and cover-letter assistance with explicit review
- Authenticated persistence contracts for Career Vault records and saved jobs
- Local-first operation when Supabase or DeepSeek is unavailable

Still scheduled for the next Phase 2 increment: export round-trip parsing that compares PDF/DOCX extraction against the source document, proposal/audit persistence in the UI, and richer semantic/recency scoring.

### Phase 3 — Complete job-search workspace (current)

- Saved jobs and a seven-state application pipeline
- Tailored resume, cover letter, job snapshot, notes, follow-up, and match score stored per opportunity
- Job workspace → tracked application handoff with targeted-resume lineage
- Immutable activity records for status, review, asset, and interview events
- DeepSeek interview preparation based on the resume, job, and verified Career Vault evidence
- Deterministic interview fallback, likely themes, answer structures, and questions for the interviewer
- Authenticated Supabase sync with local-first guest operation
- Mobile application board, detail workspace, and quick status/plan edits
- Manifest V3 job capture extension with active-tab access and client-side workspace handoff
- Expiring, revocable, asset-scoped mentor/reviewer links with comments, approvals, and change requests
- Local LinkedIn/professional-profile consistency checks without scraping or credentials
- English, Arabic, French, Spanish, German, and Portuguese document settings with native RTL preview controls

Load the unpacked extension from [`apps/extension`](./apps/extension) during development. Its popup stores the Resumora workspace origin, captures visible job content from the active tab, and passes the payload in a URL fragment that the workspace removes immediately after import.

### Phase 4 — Career intelligence moat (current)

- Unified career-memory retrieval across resumes, Career Vault evidence, applications, reviews, outcomes, and learning plans
- Versioned Resumora role/skill graph aligned to O*NET's worker, job, and market separation
- Explainable skill strength with proven, emerging, and gap states tied to verified evidence IDs
- Target and adjacent career paths with preparation signals and explicit missing evidence
- Deterministic evidence-building learning plans with DeepSeek refinement and progress tracking
- Evidence-grounded interview answer coaching with four component scores
- User-entered, privacy-controlled outcome tracking and application-to-interview signals
- Workday-, Greenhouse-, and Lever-style parser regression fixtures
- Local-first guest operation with owner-scoped Supabase sync
- Portfolio studio with per-record, per-link, and email publication consent
- Immutable public snapshots that expose only selected verified Career Vault records
- Immediate portfolio revocation with no anonymous database grants
- Multi-tenant workspaces for coaches, universities, outplacement teams, and employers
- Owner, administrator, coach, and participant roles with expiring email-bound invitations
- Participant-controlled data scopes, consent-filtered summaries, and cohort workspaces

Resumora will continue to avoid deceptive “official ATS score” claims and autonomous mass auto-apply. The product optimizes for truthful fit, document readability, and higher-quality applications.

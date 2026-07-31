# Phase 1 architecture decisions

## Deployment boundary

The Next.js application is a presentation and interaction client. Fastify owns secrets, authentication checks, document ingestion, AI calls, and signed storage access. This prevents DeepSeek, the Supabase secret key, and R2 credentials from reaching the browser.

## Canonical document model

`@resumora/domain` is the source of truth for:

- Runtime validation with Zod
- TypeScript types shared by web and API
- Template identifiers
- Explainable analysis contracts
- Deterministic scoring rules

Content and layout are separate. A resume version is a complete immutable JSON snapshot. This model can later expand into the Career Vault without requiring template migrations.

## Readiness analysis

Phase 1 scoring is deterministic and intentionally transparent:

- Machine readability: contact fields and scan-friendly bullet length
- Recruiter quality: useful summary depth, quantified scope, and action-led bullets
- Completeness: essential sections and searchable skill coverage

The overall score uses a 35/40/25 weighting, but the interface always displays the components and explicitly states that it is not an employer ATS score.

Phase 2 adds job-description fit and export round-trip parsing as separate signals.

## Persistence

Guest users receive immediate local autosave and local version snapshots. Authenticated users sync the same canonical document to Supabase. Phase 1 stores the validated document in JSONB while retaining indexed ownership, title, score, and timestamps.

The API uses the publishable Supabase client to validate access tokens, then scopes all secret-key queries to the validated user ID. Database Row Level Security supplies defense in depth.

## Private documents

Source documents are stored in Cloudflare R2, never Supabase Storage. The API issues ten-minute S3-compatible PUT URLs after authentication. Keys are namespaced by user ID and content type is part of the signature.

Temporary direct imports are capped at 2.5 MB. PDF and DOCX text extraction happens in memory; the API does not persist temporary parsing files.

## AI boundary

DeepSeek uses the OpenAI-compatible Chat Completions interface through a small provider adapter. The selected model lives in configuration, not UI or domain code.

The Phase 1 guardrails are:

- Original text is included as verified evidence.
- The model must return JSON containing a suggestion, rationale, and unsupported claims.
- Suggestions never write directly to the resume.
- Failures leave original content unchanged.
- Job descriptions will be treated as untrusted quoted data in Phase 2.

## Rendering

All templates render one semantic DOM order. PDF export uses print CSS with selectable text. DOCX uses native paragraphs, headings, bullets, and text runs. Decorative elements never contain essential information.

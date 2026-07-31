# Resumora architecture decisions through Phase 2

## Deployment boundary

The Next.js application is a presentation and interaction client. Fastify owns secrets, authentication checks, document ingestion, AI calls, and signed storage access. This prevents DeepSeek, the Supabase secret key, and R2 credentials from reaching the browser.

## Canonical document model

`@resumora/domain` is the source of truth for:

- Runtime validation with Zod
- TypeScript types shared by web and API
- Template identifiers
- Explainable analysis contracts
- Deterministic scoring rules

Content and layout are separate. A resume version is a complete immutable JSON snapshot. Targeted documents retain `sourceResumeId`, `targetJobId`, and `variantType`, so job-specific changes never silently overwrite the base resume.

## Readiness analysis

Phase 1 scoring is deterministic and intentionally transparent:

- Machine readability: contact fields and scan-friendly bullet length
- Recruiter quality: useful summary depth, quantified scope, and action-led bullets
- Completeness: essential sections and searchable skill coverage

The overall score uses a 35/40/25 weighting, but the interface always displays the components and explicitly states that it is not an employer ATS score.

Phase 2 adds a separate job-match report with hard-skill, keyword, evidence-strength, and experience-alignment components. This is deliberately not blended into the document-readiness score or presented as an employer ATS score.

## Job intelligence and Claim Ledger

Job descriptions first pass through a deterministic parser, then optionally through DeepSeek for structured extraction. The deterministic result is both a fallback and a constrained draft. Required and preferred qualifications remain separate throughout scoring and UI.

The Career Vault is the only evidence store AI may cite beyond facts already present in the resume. Tailoring returns proposals—not mutations—with source evidence IDs, added keywords, rationale, and unsupported-claim flags. The client disables acceptance when a proposal has no recognized evidence or contains unsupported language.

## Persistence

Guest users receive immediate local autosave, local Career Vault storage, and local version snapshots. Authenticated users can sync the same canonical resume, Career Vault, and saved-job data to Supabase. Resumes and variants are structured JSONB documents with indexed ownership, title, score, lineage, and timestamps.

The API uses the publishable Supabase client to validate access tokens, then scopes all secret-key queries to the validated user ID. Database Row Level Security supplies defense in depth.

## Private documents

Source documents are stored in Cloudflare R2, never Supabase Storage. The API issues ten-minute S3-compatible PUT URLs after authentication. Keys are namespaced by user ID and content type is part of the signature.

Temporary direct imports are capped at 2.5 MB. PDF and DOCX text extraction happens in memory; the API does not persist temporary parsing files.

## AI boundary

DeepSeek uses the OpenAI-compatible Chat Completions interface through a small provider adapter. The selected model lives in configuration, not UI or domain code.

The AI guardrails are:

- Original text is included as verified evidence.
- The model must return JSON containing a suggestion, rationale, and unsupported claims.
- Suggestions never write directly to the resume.
- Failures leave original content unchanged.
- Job descriptions are treated as untrusted quoted data and instructions inside them are ignored.
- Tailoring may cite only verified Career Vault record IDs supplied to the model.
- Suggestions with missing evidence or unsupported claims cannot be accepted in the Claim Ledger.

## Rendering

All templates render one semantic DOM order. PDF export uses print CSS with selectable text. DOCX uses native paragraphs, headings, bullets, and text runs. Decorative elements never contain essential information.

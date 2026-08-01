# Resumora architecture decisions through Phase 3

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

## Application lifecycle

Phase 3 treats an application as a durable aggregate rather than a card containing only a company name. Each record can retain the job snapshot, targeted resume ID, cover-letter snapshot, match signal, private notes, next action, due date, and applied date. The lifecycle is constrained to `saved → preparing → applied → interview → offer`, with `rejected` and `withdrawn` as archived outcomes.

Every meaningful change can create an append-only activity entry. Application records remain editable, while status, review, asset, and interview events preserve the decision trail. Guest records use the same shared schema in local storage; authenticated records sync through owner-scoped API routes and Supabase Row Level Security.

## Interview preparation

Interview packs combine the targeted resume, structured job analysis, and verified Career Vault records. A deterministic generator guarantees useful local preparation. DeepSeek can refine the pack, but returned evidence IDs are filtered server-side against the supplied verified records. Packs contain likely questions, why each is asked, an answer framework, evidence links, likely themes, and questions for the interviewer.

## Job capture and profile consistency

The browser extension uses Manifest V3, requests only active-tab, scripting, storage, and context-menu capabilities, and ships no remotely hosted code. It extracts visible job content only after a user gesture. The payload enters the web app through a URL fragment, so it is not sent in an HTTP request, and the workspace removes the fragment after decoding it.

Profile consistency is a deterministic, client-side comparison between the active resume and text the user chooses to paste from LinkedIn or another professional profile. Resumora does not scrape profiles, request third-party credentials, or automatically overwrite either document.

## Scoped external review

External review invitations are owned by an authenticated user and limited to one application asset: the application overview, targeted resume, or cover letter. The API returns a 256-bit random token once, stores only its SHA-256 hash, and rejects expired or revoked links. Public review routes use the server-only Supabase client after token validation; anonymous database grants are not used. Private notes, the Career Vault, and unrelated applications are excluded from shared payloads.

Reviewers can comment, approve, or request changes. Their feedback is stored on the owner's application record and remains auditable alongside the invitation that authorized it.

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

Resume documents also carry an explicit language and text direction. Structural headings and date formatting are localized for six languages, while the user's body copy is preserved verbatim. RTL affects presentation only; semantic section order and plain-text content stay intact for parsing.

## Career intelligence

Phase 4 adds a versioned role graph whose structure follows the O*NET distinction between worker capabilities and job requirements. The initial graph is maintained inside Resumora so guest mode is deterministic and no external taxonomy credential is required. It is a preparation model, not a claim that a title is formally equivalent to a specific O*NET-SOC occupation.

Skill strength is calculated from plain-text resume presence, verified Career Vault records, and measurable scope. Each skill remains visible as proven, emerging, or missing, with its importance, evidence IDs, and explanation. Readiness and adjacent-path values are explicitly described as preparation signals rather than hiring, promotion, salary, or labor-market predictions.

The deterministic engine always produces a gap report, career paths, evidence-building actions, outcome insights, and interview-coaching feedback. DeepSeek may refine action wording or critique an answer, but it receives the deterministic draft and verified evidence ledger, cannot create new skill/action identifiers, and has returned evidence IDs filtered against the supplied records.

## Career memory and outcome privacy

Career-memory search is lexical and owner-scoped. Guest mode searches the current resume, Career Vault, applications, and user-entered outcomes in the browser. Authenticated mode additionally retrieves the user's saved resumes, reviewer feedback, and learning plans through the backend. It does not create or persist opaque embeddings.

Outcomes are explicitly entered by the user. Every outcome has an `includeInInsights` control; excluded records remain private and are omitted from calibration. Resumora does not infer rejection reasons, share raw outcome notes, or describe personal results as general labor-market statistics.

## Consent-based portfolio publishing

The portfolio studio never serves a live Career Vault or resume document. On publication, the backend loads the owner's synced resume and verified Career Vault server-side, rejects unknown or unverified evidence IDs, and creates an immutable public snapshot containing only selected records, selected HTTP(S) links, and an email address when the user explicitly enables it. Phone numbers, private outcomes, applications, coaching answers, and unselected evidence never enter the snapshot.

Public portfolio routes read only snapshots whose status is `published` and whose revocation timestamp is empty. The portfolio table has owner-only RLS and no anonymous grant; Render performs the narrow public lookup with its server credential. Revocation changes the status immediately, while later private edits remain disconnected until the owner publishes a new approved snapshot.

## Organization authorization and participant consent

Organizations use four roles: owner, administrator, coach, and participant. Membership controls access to the workspace itself but does not grant career-data access. Organization invitations contain 256-bit random tokens stored only as SHA-256 hashes, expire within thirty days, are bound to one email address, and require an authenticated matching account to accept.

Participants grant individual scopes for career summary, selected evidence, application progress, and learning-plan progress. The initial staff roster uses only the career-summary scope and a participant-written summary record. Complete resumes, raw Career Vault records, employer notes, outcome interpretations, and coaching answers are not returned. Participants can revoke every scope without deleting their private Resumora data. Cohorts group participants operationally but do not expand the data scopes granted to staff.

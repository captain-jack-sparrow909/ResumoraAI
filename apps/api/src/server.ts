import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { createHash, randomBytes } from "node:crypto";
import {
  analyzeResume,
  applicationActivitySchema,
  applicationReviewInviteSchema,
  applicationReviewSchema,
  applicationSchema,
  buildInterviewPrep,
  buildCareerIntelligence,
  buildInterviewCoachFeedback,
  careerCoachFeedbackSchema,
  careerEvidenceSchema,
  careerGoalSchema,
  careerLearningPlanSchema,
  careerMemoryItemSchema,
  careerOutcomeSchema,
  careerRoleTaxonomyVersion,
  interviewPackSchema,
  jobAnalysisSchema,
  parseJobDescription,
  buildPublicPortfolio,
  organizationDataGrantSchema,
  organizationParticipantProfileSchema,
  organizationSchema,
  portfolioPublicationSchema,
  publicPortfolioSchema,
  resumeSchema,
  searchCareerMemory,
  scoreJobMatch,
} from "@resumora/domain";
import { z } from "zod";
import { capabilities, config } from "./config.js";
import {
  analyzeJobWithDeepSeek,
  coachInterviewAnswerWithDeepSeek,
  refineCareerPlanWithDeepSeek,
  rewriteWithDeepSeek,
  tailorResumeWithDeepSeek,
  prepareInterviewWithDeepSeek,
  writeCoverLetterWithDeepSeek,
} from "./services/deepseek.js";
import { extractResumeText, inferBasics } from "./services/importer.js";
import { createUploadUrl } from "./services/r2.js";
import { getRequestUser, getSupabaseAdmin } from "./services/supabase.js";

const app = Fastify({ logger: true, bodyLimit: 2_500_000 });

const hashReviewToken = (token: string) => createHash("sha256").update(token).digest("hex");

await app.register(cors, {
  origin(origin, callback) {
    if (!origin || config.webOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin not allowed"), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});
await app.register(multipart, { limits: { fileSize: 2_500_000, files: 1 } });

app.get("/health", async () => ({
  status: "ok",
  service: "resumora-api",
  capabilities,
  model: config.deepseek.model,
  timestamp: new Date().toISOString(),
}));

app.post("/v1/analyze", async (request, reply) => {
  const parsed = resumeSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid resume", issues: parsed.error.issues });
  return analyzeResume(parsed.data);
});

app.post("/v1/import", async (request, reply) => {
  const file = await request.file();
  if (!file) return reply.code(400).send({ error: "A PDF, DOCX, or TXT file is required" });
  try {
    const buffer = await file.toBuffer();
    const text = await extractResumeText(buffer, file.mimetype, file.filename);
    return { filename: file.filename, bytes: buffer.length, extracted: inferBasics(text) };
  } catch (error) {
    return reply.code(422).send({ error: error instanceof Error ? error.message : "Import failed" });
  }
});

const rewriteSchema = z.object({
  content: z.string().min(10).max(4000),
  fieldType: z.enum(["summary", "bullet"]),
  role: z.string().max(160).optional(),
  evidence: z.array(z.string().max(500)).max(20).optional(),
});

app.post("/v1/ai/rewrite", async (request, reply) => {
  const input = rewriteSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid rewrite request", issues: input.error.issues });
  if (!capabilities.ai) return reply.code(503).send({ error: "AI is not configured", code: "AI_NOT_CONFIGURED" });
  try {
    return await rewriteWithDeepSeek(input.data);
  } catch (error) {
    request.log.error(error);
    return reply.code(502).send({ error: "AI rewrite failed. Your original content is unchanged." });
  }
});

const jobDescriptionSchema = z.object({
  description: z.string().min(120).max(50_000),
  useAI: z.boolean().default(true),
});

app.post("/v1/jobs/analyze", async (request, reply) => {
  const input = jobDescriptionSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Paste a complete job description", issues: input.error.issues });
  const deterministic = parseJobDescription(input.data.description);
  if (!input.data.useAI || !capabilities.ai) return { analysis: deterministic, source: "deterministic" };
  try {
    const result = await analyzeJobWithDeepSeek(input.data.description, deterministic);
    return result ? { ...result, source: "deepseek" } : { analysis: deterministic, source: "deterministic" };
  } catch (error) {
    request.log.warn(error);
    return { analysis: deterministic, source: "deterministic", warning: "AI extraction was unavailable; deterministic analysis was used." };
  }
});

const matchSchema = z.object({
  resume: resumeSchema,
  job: jobAnalysisSchema,
  evidence: z.array(careerEvidenceSchema).max(500),
});

app.post("/v1/tailor/match", async (request, reply) => {
  const input = matchSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid tailoring context", issues: input.error.issues });
  return scoreJobMatch(input.data.resume, input.data.job, input.data.evidence);
});

app.post("/v1/ai/tailor", async (request, reply) => {
  const input = matchSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid tailoring context", issues: input.error.issues });
  if (!capabilities.ai) return reply.code(503).send({ error: "AI is not configured", code: "AI_NOT_CONFIGURED" });
  try {
    return await tailorResumeWithDeepSeek(input.data.resume, input.data.job, input.data.evidence);
  } catch (error) {
    request.log.error(error);
    return reply.code(502).send({ error: "Tailoring failed. Your resume is unchanged." });
  }
});

app.post("/v1/ai/cover-letter", async (request, reply) => {
  const input = matchSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid cover letter context", issues: input.error.issues });
  if (!capabilities.ai) return reply.code(503).send({ error: "AI is not configured", code: "AI_NOT_CONFIGURED" });
  try {
    return await writeCoverLetterWithDeepSeek(input.data.resume, input.data.job, input.data.evidence);
  } catch (error) {
    request.log.error(error);
    return reply.code(502).send({ error: "Cover letter generation failed." });
  }
});

const interviewPrepRequestSchema = matchSchema.extend({ applicationId: z.string().min(1).max(120) });

app.post("/v1/ai/interview-prep", async (request, reply) => {
  const input = interviewPrepRequestSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid interview context", issues: input.error.issues });
  const deterministic = buildInterviewPrep(input.data.applicationId, input.data.job, input.data.evidence);
  if (!capabilities.ai) return deterministic;
  try {
    return await prepareInterviewWithDeepSeek(
      input.data.applicationId,
      input.data.resume,
      input.data.job,
      input.data.evidence,
      {
        questions: deterministic.questions,
        themes: deterministic.themes,
        questionsForInterviewer: deterministic.questionsForInterviewer,
      },
    ) ?? deterministic;
  } catch (error) {
    request.log.warn(error);
    return { ...deterministic, warning: "DeepSeek was unavailable; deterministic interview preparation was used." };
  }
});

const vaultSchema = z.object({ evidence: z.array(careerEvidenceSchema).max(500) });

app.get("/v1/career-vault", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("career_profiles").select("profile, updated_at").eq("user_id", user.id).maybeSingle();
  if (error) return reply.code(500).send({ error: "Could not load Career Vault" });
  return { evidence: data?.profile?.evidence ?? [], updatedAt: data?.updated_at ?? null };
});

app.put("/v1/career-vault", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = vaultSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid Career Vault", issues: input.error.issues });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const updatedAt = new Date().toISOString();
  const { error } = await database.from("career_profiles").upsert({ user_id: user.id, profile: input.data, updated_at: updatedAt }, { onConflict: "user_id" });
  if (error) return reply.code(500).send({ error: "Could not save Career Vault" });
  return { evidence: input.data.evidence, updatedAt };
});

app.get("/v1/jobs", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("job_postings").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return reply.code(500).send({ error: "Could not load saved jobs" });
  return { data };
});

app.post("/v1/jobs", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = z.object({ id: z.string(), title: z.string(), company: z.string(), description: z.string(), analysis: jobAnalysisSchema }).safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid job" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("job_postings").upsert({ ...input.data, user_id: user.id }).select().single();
  if (error) return reply.code(500).send({ error: "Could not save job" });
  return { data };
});

const toApplicationRow = (application: z.infer<typeof applicationSchema>, userId: string) => ({
  id: application.id,
  user_id: userId,
  job_id: application.jobId ?? null,
  resume_id: application.resumeId ?? null,
  cover_letter_id: application.coverLetterId ?? null,
  role: application.role,
  company: application.company,
  location: application.location,
  source_url: application.sourceUrl,
  status: application.status,
  match_score: application.matchScore,
  cover_letter_snapshot: application.coverLetter ?? null,
  job_snapshot: application.job ?? null,
  notes: application.notes,
  next_action: application.nextAction,
  next_action_at: application.nextActionAt,
  applied_at: application.appliedAt,
  created_at: application.createdAt,
  updated_at: application.updatedAt,
});

const fromApplicationRow = (row: Record<string, unknown>) => applicationSchema.parse({
  id: row.id,
  jobId: row.job_id ?? undefined,
  resumeId: row.resume_id ?? undefined,
  coverLetterId: row.cover_letter_id ?? undefined,
  role: row.role,
  company: row.company,
  location: row.location,
  sourceUrl: row.source_url,
  status: row.status,
  matchScore: row.match_score,
  coverLetter: row.cover_letter_snapshot ?? undefined,
  job: row.job_snapshot ?? undefined,
  notes: row.notes,
  nextAction: row.next_action,
  nextActionAt: row.next_action_at,
  appliedAt: row.applied_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

app.get("/v1/applications", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("applications").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return reply.code(500).send({ error: "Could not load applications" });
  return { data: (data ?? []).map((row) => fromApplicationRow(row as Record<string, unknown>)) };
});

app.put("/v1/applications/:id", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = applicationSchema.safeParse(request.body);
  if (!input.success || input.data.id !== (request.params as { id: string }).id) return reply.code(400).send({ error: "Invalid application", issues: input.success ? [] : input.error.issues });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("applications").upsert(toApplicationRow(input.data, user.id)).select().single();
  if (error) return reply.code(500).send({ error: "Could not save application" });
  return { data: fromApplicationRow(data as Record<string, unknown>) };
});

app.delete("/v1/applications/:id", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { error } = await database.from("applications").delete().eq("id", (request.params as { id: string }).id).eq("user_id", user.id);
  if (error) return reply.code(500).send({ error: "Could not delete application" });
  return reply.code(204).send();
});

app.get("/v1/applications/:id/activities", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("application_activities").select("*").eq("application_id", (request.params as { id: string }).id).eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return reply.code(500).send({ error: "Could not load activity" });
  return { data: (data ?? []).map((row) => applicationActivitySchema.parse({ id: row.id, applicationId: row.application_id, kind: row.kind, message: row.message, metadata: row.metadata, createdAt: row.created_at })) };
});

app.post("/v1/applications/:id/activities", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = applicationActivitySchema.safeParse(request.body);
  if (!input.success || input.data.applicationId !== (request.params as { id: string }).id) return reply.code(400).send({ error: "Invalid activity" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("application_activities").insert({ id: input.data.id, application_id: input.data.applicationId, user_id: user.id, kind: input.data.kind, message: input.data.message, metadata: input.data.metadata, created_at: input.data.createdAt }).select().single();
  if (error) return reply.code(500).send({ error: "Could not save activity" });
  return { data: applicationActivitySchema.parse({ id: data.id, applicationId: data.application_id, kind: data.kind, message: data.message, metadata: data.metadata, createdAt: data.created_at }) };
});

app.get("/v1/applications/:id/interview-pack", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("interview_packs").select("pack, updated_at").eq("application_id", (request.params as { id: string }).id).eq("user_id", user.id).maybeSingle();
  if (error) return reply.code(500).send({ error: "Could not load interview pack" });
  return { data: data?.pack ? interviewPackSchema.parse(data.pack) : null, updatedAt: data?.updated_at ?? null };
});

app.put("/v1/applications/:id/interview-pack", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = interviewPackSchema.safeParse(request.body);
  if (!input.success || input.data.applicationId !== (request.params as { id: string }).id) return reply.code(400).send({ error: "Invalid interview pack" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const updatedAt = new Date().toISOString();
  const { error } = await database.from("interview_packs").upsert({ id: `interview-${input.data.applicationId}`, application_id: input.data.applicationId, user_id: user.id, pack: input.data, updated_at: updatedAt }, { onConflict: "application_id" });
  if (error) return reply.code(500).send({ error: "Could not save interview pack" });
  return { data: input.data, updatedAt };
});

const createReviewInviteSchema = z.object({
  reviewerName: z.string().max(120).default(""),
  reviewerEmail: z.string().email().max(240),
  role: z.enum(["mentor", "reviewer", "hiring_coach"]).default("reviewer"),
  target: z.enum(["application", "resume", "cover_letter"]),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

const toReviewInvite = (row: Record<string, unknown>) => applicationReviewInviteSchema.parse({
  id: row.id,
  applicationId: row.application_id,
  reviewerName: row.reviewer_name,
  reviewerEmail: row.reviewer_email,
  role: row.role,
  target: row.target,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  acceptedAt: row.accepted_at,
  createdAt: row.created_at,
});

const toReview = (row: Record<string, unknown>) => applicationReviewSchema.parse({
  id: row.id,
  applicationId: row.application_id,
  inviteId: row.invite_id,
  authorName: row.author_name,
  target: row.target,
  body: row.body,
  decision: row.decision,
  status: row.status,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
});

app.get("/v1/applications/:id/reviews", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const applicationId = (request.params as { id: string }).id;
  const [inviteResult, reviewResult] = await Promise.all([
    database.from("application_review_invites").select("*").eq("application_id", applicationId).eq("owner_user_id", user.id).order("created_at", { ascending: false }),
    database.from("application_reviews").select("*").eq("application_id", applicationId).eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  if (inviteResult.error || reviewResult.error) return reply.code(500).send({ error: "Could not load reviewer feedback" });
  return {
    invites: (inviteResult.data ?? []).map((row) => toReviewInvite(row as Record<string, unknown>)),
    reviews: (reviewResult.data ?? []).map((row) => toReview(row as Record<string, unknown>)),
  };
});

app.post("/v1/applications/:id/review-invites", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = createReviewInviteSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid reviewer invitation", issues: input.error.issues });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const applicationId = (request.params as { id: string }).id;
  const { data: owned } = await database.from("applications").select("id").eq("id", applicationId).eq("user_id", user.id).maybeSingle();
  if (!owned) return reply.code(404).send({ error: "Application not found" });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + input.data.expiresInDays * 86400000).toISOString();
  const { data, error } = await database.from("application_review_invites").insert({
    application_id: applicationId,
    owner_user_id: user.id,
    reviewer_name: input.data.reviewerName,
    reviewer_email: input.data.reviewerEmail.toLowerCase(),
    role: input.data.role,
    target: input.data.target,
    token_hash: hashReviewToken(token),
    expires_at: expiresAt,
  }).select().single();
  if (error) return reply.code(500).send({ error: "Could not create reviewer invitation" });
  return { invite: toReviewInvite(data as Record<string, unknown>), token };
});

app.delete("/v1/applications/:applicationId/review-invites/:inviteId", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const params = request.params as { applicationId: string; inviteId: string };
  const { error } = await database.from("application_review_invites").update({ revoked_at: new Date().toISOString() }).eq("id", params.inviteId).eq("application_id", params.applicationId).eq("owner_user_id", user.id);
  if (error) return reply.code(500).send({ error: "Could not revoke invitation" });
  return reply.code(204).send();
});

const resolveSharedReview = async (token: string) => {
  const database = getSupabaseAdmin();
  if (!database || token.length < 20 || token.length > 160) return null;
  const { data: invite } = await database.from("application_review_invites").select("*").eq("token_hash", hashReviewToken(token)).maybeSingle();
  if (!invite || invite.revoked_at || new Date(invite.expires_at).getTime() <= Date.now()) return null;
  const { data: application } = await database.from("applications").select("*").eq("id", invite.application_id).eq("user_id", invite.owner_user_id).maybeSingle();
  if (!application) return null;
  let asset: unknown = null;
  if (invite.target === "resume" && application.resume_id) {
    const result = await database.from("resumes").select("document").eq("id", application.resume_id).eq("user_id", invite.owner_user_id).maybeSingle();
    asset = result.data?.document ?? null;
  } else if (invite.target === "cover_letter") {
    asset = application.cover_letter_snapshot ?? null;
  } else {
    asset = {
      role: application.role,
      company: application.company,
      location: application.location,
      sourceUrl: application.source_url,
      status: application.status,
      matchScore: application.match_score,
    };
  }
  return { database, invite, application, asset };
};

app.get("/v1/reviews/shared/:token", async (request, reply) => {
  const token = (request.params as { token: string }).token;
  const shared = await resolveSharedReview(token);
  if (!shared) return reply.code(404).send({ error: "This review link is invalid, expired, or revoked" });
  const { data: reviews } = await shared.database.from("application_reviews").select("*").eq("invite_id", shared.invite.id).order("created_at", { ascending: false });
  return {
    invitation: {
      reviewerName: shared.invite.reviewer_name,
      role: shared.invite.role,
      target: shared.invite.target,
      expiresAt: shared.invite.expires_at,
    },
    application: { role: shared.application.role, company: shared.application.company },
    asset: shared.asset,
    reviews: (reviews ?? []).map((row) => toReview(row as Record<string, unknown>)),
  };
});

const sharedReviewSchema = z.object({
  authorName: z.string().min(2).max(120),
  body: z.string().min(2).max(5000),
  decision: z.enum(["comment", "approved", "changes_requested"]).default("comment"),
});

app.post("/v1/reviews/shared/:token/comments", async (request, reply) => {
  const input = sharedReviewSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid feedback", issues: input.error.issues });
  const token = (request.params as { token: string }).token;
  const shared = await resolveSharedReview(token);
  if (!shared) return reply.code(404).send({ error: "This review link is invalid, expired, or revoked" });
  const now = new Date().toISOString();
  const { data, error } = await shared.database.from("application_reviews").insert({
    application_id: shared.invite.application_id,
    user_id: shared.invite.owner_user_id,
    invite_id: shared.invite.id,
    author_name: input.data.authorName,
    target: shared.invite.target,
    body: input.data.body,
    decision: input.data.decision,
  }).select().single();
  if (error) return reply.code(500).send({ error: "Could not save feedback" });
  if (!shared.invite.accepted_at) await shared.database.from("application_review_invites").update({ accepted_at: now }).eq("id", shared.invite.id);
  return { review: toReview(data as Record<string, unknown>) };
});

const careerIntelligenceRequestSchema = z.object({
  resume: resumeSchema,
  evidence: z.array(careerEvidenceSchema).max(500),
  applications: z.array(applicationSchema).max(500),
  outcomes: z.array(careerOutcomeSchema).max(1000),
  targetRoleId: z.string().min(1).max(120),
});

app.post("/v1/career/intelligence", async (request, reply) => {
  const input = careerIntelligenceRequestSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid career intelligence context", issues: input.error.issues });
  return buildCareerIntelligence(input.data.resume, input.data.evidence, input.data.applications, input.data.outcomes, input.data.targetRoleId);
});

const careerPlanRequestSchema = z.object({
  goal: careerGoalSchema,
  plan: careerLearningPlanSchema,
  evidence: z.array(careerEvidenceSchema).max(500),
});

app.post("/v1/ai/career-plan", async (request, reply) => {
  const input = careerPlanRequestSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid career plan context", issues: input.error.issues });
  if (!capabilities.ai) return input.data.plan;
  try {
    return await refineCareerPlanWithDeepSeek(input.data.goal, input.data.plan, input.data.evidence) ?? input.data.plan;
  } catch (error) {
    request.log.warn(error);
    return { ...input.data.plan, warning: "DeepSeek was unavailable; the deterministic evidence plan was retained." };
  }
});

const careerCoachRequestSchema = z.object({
  question: z.string().min(8).max(1000),
  answer: z.string().min(20).max(10_000),
  targetRoleId: z.string().min(1).max(120),
  targetRole: z.string().min(1).max(180),
  evidence: z.array(careerEvidenceSchema).max(500),
});

app.post("/v1/ai/interview-coach", async (request, reply) => {
  const input = careerCoachRequestSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Add a complete practice answer", issues: input.error.issues });
  const deterministic = buildInterviewCoachFeedback(input.data.question, input.data.answer, input.data.evidence, input.data.targetRoleId);
  if (!capabilities.ai) return deterministic;
  try {
    return await coachInterviewAnswerWithDeepSeek(input.data.question, input.data.answer, input.data.targetRole, input.data.evidence, deterministic) ?? deterministic;
  } catch (error) {
    request.log.warn(error);
    return { ...deterministic, warning: "DeepSeek was unavailable; deterministic coaching was used." };
  }
});

const fromCareerGoalRow = (row: Record<string, unknown>) => careerGoalSchema.parse({
  targetRoleId: row.target_role_id,
  targetTitle: row.target_title,
  horizonMonths: row.horizon_months,
  weeklyHours: row.weekly_hours,
  priorities: row.priorities,
  updatedAt: row.updated_at,
});

const fromCareerOutcomeRow = (row: Record<string, unknown>) => careerOutcomeSchema.parse({
  id: row.id,
  applicationId: row.application_id ?? undefined,
  stage: row.stage,
  result: row.result,
  reasonTags: row.reason_tags,
  notes: row.notes,
  occurredAt: row.occurred_at,
  includeInInsights: row.include_in_insights,
  createdAt: row.created_at,
});

app.get("/v1/career/state", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const [goalResult, outcomeResult, planResult, coachingResult] = await Promise.all([
    database.from("career_goals").select("*").eq("user_id", user.id).maybeSingle(),
    database.from("career_outcomes").select("*").eq("user_id", user.id).order("occurred_at", { ascending: false }),
    database.from("career_learning_plans").select("plan").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10),
    database.from("career_coaching_sessions").select("feedback").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (goalResult.error || outcomeResult.error || planResult.error || coachingResult.error) return reply.code(500).send({ error: "Could not load career intelligence state" });
  return {
    goal: goalResult.data ? fromCareerGoalRow(goalResult.data as Record<string, unknown>) : null,
    outcomes: (outcomeResult.data ?? []).map((row) => fromCareerOutcomeRow(row as Record<string, unknown>)),
    plans: (planResult.data ?? []).map((row) => careerLearningPlanSchema.parse(row.plan)),
    coaching: (coachingResult.data ?? []).map((row) => careerCoachFeedbackSchema.parse(row.feedback)),
  };
});

app.put("/v1/career/goal", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = careerGoalSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid career goal", issues: input.error.issues });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("career_goals").upsert({ user_id: user.id, target_role_id: input.data.targetRoleId, target_title: input.data.targetTitle, horizon_months: input.data.horizonMonths, weekly_hours: input.data.weeklyHours, priorities: input.data.priorities, taxonomy_version: careerRoleTaxonomyVersion, updated_at: input.data.updatedAt }, { onConflict: "user_id" }).select().single();
  if (error) return reply.code(500).send({ error: "Could not save career goal" });
  return { goal: fromCareerGoalRow(data as Record<string, unknown>) };
});

app.put("/v1/career/outcomes/:id", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = careerOutcomeSchema.safeParse(request.body);
  if (!input.success || input.data.id !== (request.params as { id: string }).id) return reply.code(400).send({ error: "Invalid career outcome" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("career_outcomes").upsert({ id: input.data.id, user_id: user.id, application_id: input.data.applicationId ?? null, stage: input.data.stage, result: input.data.result, reason_tags: input.data.reasonTags, notes: input.data.notes, occurred_at: input.data.occurredAt, include_in_insights: input.data.includeInInsights, created_at: input.data.createdAt }).select().single();
  if (error) return reply.code(500).send({ error: "Could not save career outcome" });
  return { outcome: fromCareerOutcomeRow(data as Record<string, unknown>) };
});

app.put("/v1/career/plans/:id", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = careerLearningPlanSchema.safeParse(request.body);
  if (!input.success || input.data.id !== (request.params as { id: string }).id) return reply.code(400).send({ error: "Invalid learning plan" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { error } = await database.from("career_learning_plans").upsert({ id: input.data.id, user_id: user.id, target_role_id: input.data.targetRoleId, plan: input.data, model: input.data.model, updated_at: input.data.updatedAt }, { onConflict: "id" });
  if (error) return reply.code(500).send({ error: "Could not save learning plan" });
  return { plan: input.data };
});

app.post("/v1/career/coaching-sessions", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = z.object({ id: z.string(), targetRoleId: z.string(), feedback: careerCoachFeedbackSchema }).safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid coaching session" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { error } = await database.from("career_coaching_sessions").insert({ id: input.data.id, user_id: user.id, target_role_id: input.data.targetRoleId, question: input.data.feedback.question, answer: input.data.feedback.answer, feedback: input.data.feedback, model: input.data.feedback.model });
  if (error) return reply.code(500).send({ error: "Could not save coaching session" });
  return { feedback: input.data.feedback };
});

app.get("/v1/career/memory", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const query = z.string().max(160).catch("").parse((request.query as { q?: string }).q ?? "");
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const [resumeResult, vaultResult, applicationResult, reviewResult, outcomeResult, planResult] = await Promise.all([
    database.from("resumes").select("id,title,document,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30),
    database.from("career_profiles").select("profile").eq("user_id", user.id).maybeSingle(),
    database.from("applications").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
    database.from("application_reviews").select("id,application_id,author_name,target,body,decision,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    database.from("career_outcomes").select("*").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(200),
    database.from("career_learning_plans").select("id,target_role_id,plan,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20),
  ]);
  if ([resumeResult, vaultResult, applicationResult, reviewResult, outcomeResult, planResult].some((result) => result.error)) return reply.code(500).send({ error: "Could not search career memory" });
  const items = [
    ...(resumeResult.data ?? []).flatMap((row) => {
      const parsed = resumeSchema.safeParse(row.document);
      if (!parsed.success) return [];
      return [careerMemoryItemSchema.parse({ id: `memory-resume-${row.id}`, kind: "resume", title: row.title, subtitle: parsed.data.basics.headline, content: parsed.data.summary, skills: parsed.data.skills.flatMap((group) => group.items), occurredAt: row.updated_at, sourceId: row.id }), ...parsed.data.experience.map((experience) => careerMemoryItemSchema.parse({ id: `memory-experience-${row.id}-${experience.id}`, kind: "experience", title: experience.role, subtitle: experience.company, content: experience.bullets.join(" "), skills: [], occurredAt: experience.endDate || experience.startDate, sourceId: experience.id }))];
    }),
    ...((vaultResult.data?.profile?.evidence ?? []) as unknown[]).flatMap((value) => { const parsed = careerEvidenceSchema.safeParse(value); return parsed.success ? [careerMemoryItemSchema.parse({ id: `memory-evidence-${parsed.data.id}`, kind: "evidence", title: parsed.data.title, subtitle: parsed.data.organization, content: `${parsed.data.description} ${parsed.data.metrics.join(" ")}`, skills: parsed.data.skills, occurredAt: parsed.data.date, sourceId: parsed.data.id })] : []; }),
    ...(applicationResult.data ?? []).map((row) => careerMemoryItemSchema.parse({ id: `memory-application-${row.id}`, kind: "application", title: row.role, subtitle: row.company, content: `${row.notes} ${row.next_action}`, skills: row.job_snapshot?.keywords ?? [], occurredAt: row.updated_at, sourceId: row.id })),
    ...(reviewResult.data ?? []).map((row) => careerMemoryItemSchema.parse({ id: `memory-review-${row.id}`, kind: "review", title: `${row.author_name} · ${row.decision}`, subtitle: row.target, content: row.body, skills: [], occurredAt: row.created_at, sourceId: row.application_id })),
    ...(outcomeResult.data ?? []).map((row) => { const outcome = fromCareerOutcomeRow(row as Record<string, unknown>); return careerMemoryItemSchema.parse({ id: `memory-outcome-${outcome.id}`, kind: "outcome", title: `${outcome.stage.replaceAll("_", " ")} · ${outcome.result}`, subtitle: outcome.reasonTags.join(" · "), content: outcome.notes, skills: [], occurredAt: outcome.occurredAt, sourceId: outcome.id }); }),
    ...(planResult.data ?? []).map((row) => { const plan = careerLearningPlanSchema.parse(row.plan); return careerMemoryItemSchema.parse({ id: `memory-learning-${row.id}`, kind: "learning", title: plan.title, subtitle: plan.targetRoleId, content: `${plan.summary} ${plan.actions.map((action) => `${action.skill} ${action.title}`).join(" ")}`, skills: plan.actions.map((action) => action.skill), occurredAt: row.updated_at, sourceId: row.id }); }),
  ];
  return { items: searchCareerMemory(items, query), query };
});

const toPortfolioPublication = (row: Record<string, unknown>) => portfolioPublicationSchema.parse({
  ...(row.configuration as Record<string, unknown>),
  id: row.id,
  slug: row.slug,
  status: row.status,
  consentVersion: row.consent_version,
  publishedAt: row.published_at ?? undefined,
  updatedAt: row.updated_at,
});

app.get("/v1/portfolio", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("portfolio_publications").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return reply.code(500).send({ error: "Could not load portfolio settings" });
  return { publication: data ? toPortfolioPublication(data as Record<string, unknown>) : null };
});

app.put("/v1/portfolio/:id", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = portfolioPublicationSchema.safeParse(request.body);
  if (!input.success || input.data.id !== (request.params as { id: string }).id) return reply.code(400).send({ error: "Invalid portfolio publication", issues: input.success ? undefined : input.error.issues });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const [resumeResult, vaultResult] = await Promise.all([
    database.from("resumes").select("document").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    database.from("career_profiles").select("profile").eq("user_id", user.id).maybeSingle(),
  ]);
  const resume = resumeSchema.safeParse(resumeResult.data?.document);
  if (!resume.success) return reply.code(409).send({ error: "Sync a resume before publishing a portfolio" });
  const evidence = ((vaultResult.data?.profile?.evidence ?? []) as unknown[]).flatMap((item) => {
    const parsed = careerEvidenceSchema.safeParse(item);
    return parsed.success && parsed.data.verified ? [parsed.data] : [];
  });
  const allowedIds = new Set(evidence.map((item) => item.id));
  if (input.data.evidenceIds.some((id) => !allowedIds.has(id))) return reply.code(400).send({ error: "Portfolio selections must reference verified Career Vault records" });
  if (input.data.status === "published" && input.data.evidenceIds.length === 0) return reply.code(400).send({ error: "Select at least one verified project before publishing" });
  const now = new Date().toISOString();
  const publication = portfolioPublicationSchema.parse({
    ...input.data,
    publishedAt: input.data.status === "published" ? input.data.publishedAt ?? now : input.data.publishedAt,
    updatedAt: now,
  });
  const snapshot = buildPublicPortfolio(publication, resume.data, evidence);
  const { data, error } = await database.from("portfolio_publications").upsert({
    id: publication.id,
    user_id: user.id,
    slug: publication.slug,
    configuration: publication,
    public_snapshot: snapshot,
    status: publication.status,
    consent_version: publication.consentVersion,
    consented_at: publication.status === "published" ? now : null,
    published_at: publication.publishedAt ?? null,
    revoked_at: publication.status === "revoked" ? now : null,
    updated_at: now,
  }, { onConflict: "id" }).select("*").single();
  if (error?.code === "23505") return reply.code(409).send({ error: "That public address is already in use" });
  if (error) return reply.code(500).send({ error: "Could not save portfolio publication" });
  return { publication: toPortfolioPublication(data as Record<string, unknown>), publicPortfolio: snapshot };
});

app.get("/v1/public/portfolios/:slug", async (request, reply) => {
  const slug = z.string().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).safeParse((request.params as { slug: string }).slug);
  if (!slug.success) return reply.code(404).send({ error: "Portfolio not found" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("portfolio_publications").select("public_snapshot").eq("slug", slug.data).eq("status", "published").is("revoked_at", null).maybeSingle();
  if (error || !data) return reply.code(404).send({ error: "Portfolio not found" });
  const portfolio = publicPortfolioSchema.safeParse(data.public_snapshot);
  if (!portfolio.success) return reply.code(404).send({ error: "Portfolio not found" });
  reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return { portfolio: portfolio.data };
});

const organizationCreateSchema = organizationSchema.pick({ name: true, slug: true, type: true });
const organizationInviteSchema = z.object({ email: z.string().email(), role: z.enum(["admin", "coach", "participant"]), expiresInDays: z.number().int().min(1).max(30).default(7) });

const mapOrganization = (row: Record<string, unknown>) => organizationSchema.parse({ id: row.id, name: row.name, slug: row.slug, type: row.type, createdAt: row.created_at });
const getOrganizationMembership = async (database: ReturnType<typeof getSupabaseAdmin>, organizationId: string, userId: string) => {
  if (!database) return null;
  const { data } = await database.from("organization_members").select("*").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  return data as Record<string, unknown> | null;
};

app.get("/v1/organizations", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data: memberships, error } = await database.from("organization_members").select("organization_id,role").eq("user_id", user.id);
  if (error) return reply.code(500).send({ error: "Could not load organizations" });
  const ids = (memberships ?? []).map((item) => item.organization_id);
  if (!ids.length) return { organizations: [] };
  const { data: organizations } = await database.from("organizations").select("*").in("id", ids).order("created_at", { ascending: false });
  const roles = new Map((memberships ?? []).map((item) => [item.organization_id, item.role]));
  return { organizations: (organizations ?? []).map((row) => ({ ...mapOrganization(row as Record<string, unknown>), role: roles.get(row.id) })) };
});

app.post("/v1/organizations", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = organizationCreateSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid organization", issues: input.error.issues });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("organizations").insert({ ...input.data, created_by: user.id }).select("*").single();
  if (error?.code === "23505") return reply.code(409).send({ error: "That organization address is already in use" });
  if (error || !data) return reply.code(500).send({ error: "Could not create organization" });
  const { error: memberError } = await database.from("organization_members").insert({ organization_id: data.id, user_id: user.id, display_name: user.user_metadata?.full_name ?? "", email: user.email ?? "", role: "owner" });
  if (memberError) {
    await database.from("organizations").delete().eq("id", data.id).eq("created_by", user.id);
    return reply.code(500).send({ error: "Could not establish organization ownership" });
  }
  return { organization: { ...mapOrganization(data as Record<string, unknown>), role: "owner" } };
});

app.get("/v1/organizations/:organizationId", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const organizationId = (request.params as { organizationId: string }).organizationId;
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const membership = await getOrganizationMembership(database, organizationId, user.id);
  if (!membership) return reply.code(403).send({ error: "Organization membership required" });
  const isStaff = ["owner", "admin", "coach"].includes(String(membership.role));
  const [organizationResult, memberResult, grantResult, profileResult, cohortResult] = await Promise.all([
    database.from("organizations").select("*").eq("id", organizationId).single(),
    database.from("organization_members").select("organization_id,user_id,display_name,email,role,joined_at").eq("organization_id", organizationId).order("joined_at"),
    database.from("organization_data_grants").select("*").eq("organization_id", organizationId),
    database.from("organization_participant_profiles").select("*").eq("organization_id", organizationId),
    database.from("organization_cohorts").select("*").eq("organization_id", organizationId).order("created_at"),
  ]);
  if (organizationResult.error) return reply.code(404).send({ error: "Organization not found" });
  const grants = (grantResult.data ?? []).filter((row) => isStaff || row.participant_user_id === user.id).map((row) => organizationDataGrantSchema.parse({ organizationId: row.organization_id, participantUserId: row.participant_user_id, scopes: row.scopes, consentedAt: row.consented_at, revokedAt: row.revoked_at ?? undefined }));
  const activeSummaryGrants = new Set(grants.filter((grant) => !grant.revokedAt && grant.scopes.includes("resume_summary")).map((grant) => grant.participantUserId));
  const profiles = (profileResult.data ?? []).filter((row) => row.participant_user_id === user.id || (isStaff && activeSummaryGrants.has(row.participant_user_id))).flatMap((row) => {
    const parsed = organizationParticipantProfileSchema.safeParse(row.shared_profile);
    return parsed.success ? [parsed.data] : [];
  });
  return {
    organization: { ...mapOrganization(organizationResult.data as Record<string, unknown>), role: membership.role },
    members: isStaff ? memberResult.data ?? [] : (memberResult.data ?? []).filter((row) => row.user_id === user.id),
    grants,
    profiles,
    cohorts: cohortResult.data ?? [],
  };
});

app.post("/v1/organizations/:organizationId/invites", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const organizationId = (request.params as { organizationId: string }).organizationId;
  const input = organizationInviteSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid invitation", issues: input.error.issues });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const membership = await getOrganizationMembership(database, organizationId, user.id);
  if (!membership || !["owner", "admin", "coach"].includes(String(membership.role)) || (membership.role === "coach" && input.data.role !== "participant")) return reply.code(403).send({ error: "Organization staff access required" });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + input.data.expiresInDays * 86_400_000).toISOString();
  const { data, error } = await database.from("organization_invites").insert({ organization_id: organizationId, email: input.data.email.toLowerCase(), role: input.data.role, token_hash: hashReviewToken(token), invited_by: user.id, expires_at: expiresAt }).select("id,email,role,expires_at").single();
  if (error) return reply.code(500).send({ error: "Could not create invitation" });
  return { invitation: { id: data.id, email: data.email, role: data.role, expiresAt: data.expires_at }, token };
});

app.post("/v1/organization-invites/accept", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = z.object({ token: z.string().min(20).max(200), displayName: z.string().max(120).default("") }).safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid invitation token" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data: invite } = await database.from("organization_invites").select("*").eq("token_hash", hashReviewToken(input.data.token)).maybeSingle();
  if (!invite || invite.revoked_at || invite.accepted_at || new Date(invite.expires_at) <= new Date()) return reply.code(410).send({ error: "This invitation is invalid or expired" });
  if (!user.email || invite.email.toLowerCase() !== user.email.toLowerCase()) return reply.code(403).send({ error: "Sign in with the invited email address" });
  const { error } = await database.from("organization_members").upsert({ organization_id: invite.organization_id, user_id: user.id, display_name: input.data.displayName || user.user_metadata?.full_name || "", email: user.email, role: invite.role }, { onConflict: "organization_id,user_id" });
  if (error) return reply.code(500).send({ error: "Could not accept invitation" });
  await database.from("organization_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  return { organizationId: invite.organization_id, role: invite.role };
});

app.put("/v1/organizations/:organizationId/grant", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const organizationId = (request.params as { organizationId: string }).organizationId;
  const input = z.object({ scopes: z.array(z.enum(["resume_summary", "career_evidence", "application_progress", "learning_plan"])).max(4) }).safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid consent scopes" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const membership = await getOrganizationMembership(database, organizationId, user.id);
  if (!membership || membership.role !== "participant") return reply.code(403).send({ error: "Participant membership required" });
  const now = new Date().toISOString();
  const { data, error } = await database.from("organization_data_grants").upsert({ organization_id: organizationId, participant_user_id: user.id, scopes: input.data.scopes, consented_at: now, revoked_at: input.data.scopes.length ? null : now, updated_at: now }, { onConflict: "organization_id,participant_user_id" }).select("*").single();
  if (error) return reply.code(500).send({ error: "Could not update sharing consent" });
  return { grant: organizationDataGrantSchema.parse({ organizationId: data.organization_id, participantUserId: data.participant_user_id, scopes: data.scopes, consentedAt: data.consented_at, revokedAt: data.revoked_at ?? undefined }) };
});

app.put("/v1/organizations/:organizationId/profile", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const organizationId = (request.params as { organizationId: string }).organizationId;
  const input = organizationParticipantProfileSchema.safeParse(request.body);
  if (!input.success || input.data.organizationId !== organizationId || input.data.participantUserId !== user.id) return reply.code(400).send({ error: "Invalid shared participant profile" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const membership = await getOrganizationMembership(database, organizationId, user.id);
  if (!membership || membership.role !== "participant") return reply.code(403).send({ error: "Participant membership required" });
  const { error } = await database.from("organization_participant_profiles").upsert({ organization_id: organizationId, participant_user_id: user.id, shared_profile: input.data, updated_at: new Date().toISOString() }, { onConflict: "organization_id,participant_user_id" });
  if (error) return reply.code(500).send({ error: "Could not update the shared profile" });
  return { profile: input.data };
});

app.post("/v1/organizations/:organizationId/cohorts", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const organizationId = (request.params as { organizationId: string }).organizationId;
  const input = z.object({ name: z.string().min(2).max(120) }).safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid cohort name" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const membership = await getOrganizationMembership(database, organizationId, user.id);
  if (!membership || !["owner", "admin", "coach"].includes(String(membership.role))) return reply.code(403).send({ error: "Organization staff access required" });
  const { data, error } = await database.from("organization_cohorts").insert({ organization_id: organizationId, name: input.data.name }).select("*").single();
  if (error) return reply.code(500).send({ error: "Could not create cohort" });
  return { cohort: data };
});

const uploadSchema = z.object({
  filename: z.string().min(1).max(180),
  contentType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});

app.post("/v1/uploads/presign", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const input = uploadSchema.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: "Invalid upload request" });
  const result = await createUploadUrl(user.id, input.data.filename, input.data.contentType);
  if (!result) return reply.code(503).send({ error: "Storage is not configured" });
  return result;
});

app.get("/v1/resumes", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const { data, error } = await database.from("resumes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return reply.code(500).send({ error: "Could not load resumes" });
  return { data };
});

app.put("/v1/resumes/:id", async (request, reply) => {
  const user = await getRequestUser(request);
  if (!user) return reply.code(401).send({ error: "Authentication required" });
  const resume = resumeSchema.safeParse(request.body);
  if (!resume.success || resume.data.id !== (request.params as { id: string }).id) {
    return reply.code(400).send({ error: "Invalid resume" });
  }
  const database = getSupabaseAdmin();
  if (!database) return reply.code(503).send({ error: "Database is not configured" });
  const analysis = analyzeResume(resume.data);
  const { data, error } = await database
    .from("resumes")
    .upsert({ id: resume.data.id, user_id: user.id, title: resume.data.title, document: resume.data, score: analysis.overall, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) return reply.code(500).send({ error: "Could not save resume" });
  return { data, analysis };
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  const statusCode = typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
    ? error.statusCode
    : 500;
  const message = error instanceof Error ? error.message : "Unexpected server error";
  reply.code(statusCode).send({ error: statusCode < 500 ? message : "Unexpected server error" });
});

await app.listen({ port: config.port, host: "0.0.0.0" });

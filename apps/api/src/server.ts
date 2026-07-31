import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import {
  analyzeResume,
  applicationActivitySchema,
  applicationSchema,
  buildInterviewPrep,
  careerEvidenceSchema,
  interviewPackSchema,
  jobAnalysisSchema,
  parseJobDescription,
  resumeSchema,
  scoreJobMatch,
} from "@resumora/domain";
import { z } from "zod";
import { capabilities, config } from "./config.js";
import {
  analyzeJobWithDeepSeek,
  rewriteWithDeepSeek,
  tailorResumeWithDeepSeek,
  prepareInterviewWithDeepSeek,
  writeCoverLetterWithDeepSeek,
} from "./services/deepseek.js";
import { extractResumeText, inferBasics } from "./services/importer.js";
import { createUploadUrl } from "./services/r2.js";
import { getRequestUser, getSupabaseAdmin } from "./services/supabase.js";

const app = Fastify({ logger: true, bodyLimit: 2_500_000 });

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

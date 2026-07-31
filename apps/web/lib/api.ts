import type {
  CareerEvidence,
  JobAnalysis,
  JobMatchReport,
  ResumeAnalysis,
  ResumeDocument,
  TailoringProposal,
} from "@resumora/domain";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

export async function analyzeRemotely(resume: ResumeDocument): Promise<ResumeAnalysis> {
  const response = await fetch(`${apiUrl}/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resume),
  });
  if (!response.ok) throw new Error("Analysis service unavailable");
  return response.json();
}

export async function importResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiUrl}/v1/import`, { method: "POST", body: form });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Could not import resume");
  return body as {
    filename: string;
    extracted: { fullName: string; email: string; phone: string; links: string[]; rawText: string };
  };
}

export async function rewriteContent(content: string, fieldType: "summary" | "bullet", role?: string) {
  const response = await fetch(`${apiUrl}/v1/ai/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, fieldType, role, evidence: [content] }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.code === "AI_NOT_CONFIGURED" ? "Connect DeepSeek to enable AI suggestions." : body.error);
  return body as { suggestion: string; rationale: string; unsupportedClaims: string[]; model: string };
}

export async function saveResumeRemotely(resume: ResumeDocument, token: string) {
  const response = await fetch(`${apiUrl}/v1/resumes/${resume.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(resume),
  });
  if (!response.ok) throw new Error("Cloud sync unavailable");
  return response.json();
}

async function jsonRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "The request could not be completed");
  return payload as T;
}

async function authenticatedRequest<T>(path: string, token: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Cloud sync unavailable");
  return payload as T;
}

export async function analyzeJobDescription(description: string) {
  return jsonRequest<{ analysis: JobAnalysis; source: "deepseek" | "deterministic"; model?: string; warning?: string }>("/v1/jobs/analyze", { description, useAI: true });
}

export async function getJobMatch(resume: ResumeDocument, job: JobAnalysis, evidence: CareerEvidence[]) {
  return jsonRequest<JobMatchReport>("/v1/tailor/match", { resume, job, evidence });
}

export async function getTailoringProposals(resume: ResumeDocument, job: JobAnalysis, evidence: CareerEvidence[]) {
  return jsonRequest<{ proposals: TailoringProposal[]; model: string }>("/v1/ai/tailor", { resume, job, evidence });
}

export async function generateCoverLetter(resume: ResumeDocument, job: JobAnalysis, evidence: CareerEvidence[]) {
  return jsonRequest<{ subject: string; letter: string; evidenceIds: string[]; unsupportedClaims: string[]; model: string }>("/v1/ai/cover-letter", { resume, job, evidence });
}

export async function loadCareerVault(token: string) {
  return authenticatedRequest<{ evidence: CareerEvidence[]; updatedAt: string | null }>("/v1/career-vault", token, "GET");
}

export async function saveCareerVault(evidence: CareerEvidence[], token: string) {
  return authenticatedRequest<{ evidence: CareerEvidence[]; updatedAt: string }>("/v1/career-vault", token, "PUT", { evidence });
}

export async function saveJobPosting(description: string, analysis: JobAnalysis, token: string) {
  const normalizedRole = analysis.role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return authenticatedRequest<{ data: unknown }>("/v1/jobs", token, "POST", {
    id: `job-${normalizedRole}-${Date.now()}`,
    title: analysis.role,
    company: analysis.company,
    description,
    analysis,
  });
}

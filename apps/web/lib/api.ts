import type { ResumeAnalysis, ResumeDocument } from "@resumora/domain";

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

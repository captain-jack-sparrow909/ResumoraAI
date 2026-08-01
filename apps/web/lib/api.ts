import type {
  ApplicationActivity,
  ApplicationReview,
  ApplicationReviewInvite,
  CareerCoachFeedback,
  CareerEvidence,
  CareerGoal,
  CareerIntelligenceReport,
  CareerLearningPlan,
  CareerMemoryItem,
  CareerOutcome,
  InterviewPack,
  JobAnalysis,
  JobApplication,
  JobMatchReport,
  Organization,
  OrganizationDataGrant,
  OrganizationParticipantProfile,
  PortfolioPublication,
  PublicPortfolio,
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

export async function loadApplications(token: string) {
  return authenticatedRequest<{ data: JobApplication[] }>("/v1/applications", token, "GET");
}

export async function saveApplication(application: JobApplication, token: string) {
  return authenticatedRequest<{ data: JobApplication }>(`/v1/applications/${application.id}`, token, "PUT", application);
}

export async function loadApplicationActivity(applicationId: string, token: string) {
  return authenticatedRequest<{ data: ApplicationActivity[] }>(`/v1/applications/${applicationId}/activities`, token, "GET");
}

export async function saveApplicationActivity(activity: ApplicationActivity, token: string) {
  return authenticatedRequest<{ data: ApplicationActivity }>(`/v1/applications/${activity.applicationId}/activities`, token, "POST", activity);
}

export async function generateInterviewPrep(applicationId: string, resume: ResumeDocument, job: JobAnalysis, evidence: CareerEvidence[]) {
  return jsonRequest<InterviewPack & { warning?: string }>("/v1/ai/interview-prep", { applicationId, resume, job, evidence });
}

export async function saveInterviewPack(pack: InterviewPack, token: string) {
  return authenticatedRequest<{ data: InterviewPack; updatedAt: string }>(`/v1/applications/${pack.applicationId}/interview-pack`, token, "PUT", pack);
}

export async function loadInterviewPack(applicationId: string, token: string) {
  return authenticatedRequest<{ data: InterviewPack | null; updatedAt: string | null }>(`/v1/applications/${applicationId}/interview-pack`, token, "GET");
}

export async function loadReviewerFeedback(applicationId: string, token: string) {
  return authenticatedRequest<{ invites: ApplicationReviewInvite[]; reviews: ApplicationReview[] }>(`/v1/applications/${applicationId}/reviews`, token, "GET");
}

export async function createReviewInvite(applicationId: string, token: string, input: { reviewerName: string; reviewerEmail: string; role: "mentor" | "reviewer" | "hiring_coach"; target: "application" | "resume" | "cover_letter"; expiresInDays: number }) {
  return authenticatedRequest<{ invite: ApplicationReviewInvite; token: string }>(`/v1/applications/${applicationId}/review-invites`, token, "POST", input);
}

export async function revokeReviewInvite(applicationId: string, inviteId: string, token: string) {
  const response = await fetch(`${apiUrl}/v1/applications/${applicationId}/review-invites/${inviteId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) { const payload = await response.json(); throw new Error(payload.error ?? "Could not revoke invitation"); }
}

export type SharedReviewPayload = {
  invitation: { reviewerName: string; role: "mentor" | "reviewer" | "hiring_coach"; target: "application" | "resume" | "cover_letter"; expiresAt: string };
  application: { role: string; company: string };
  asset: unknown;
  reviews: ApplicationReview[];
};

export async function loadSharedReview(token: string) {
  const response = await fetch(`${apiUrl}/v1/reviews/shared/${encodeURIComponent(token)}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Could not open review");
  return payload as SharedReviewPayload;
}

export async function submitSharedReview(token: string, input: { authorName: string; body: string; decision: "comment" | "approved" | "changes_requested" }) {
  return jsonRequest<{ review: ApplicationReview }>(`/v1/reviews/shared/${encodeURIComponent(token)}/comments`, input);
}

export async function getCareerIntelligence(resume: ResumeDocument, evidence: CareerEvidence[], applications: JobApplication[], outcomes: CareerOutcome[], targetRoleId: string) {
  return jsonRequest<CareerIntelligenceReport>("/v1/career/intelligence", { resume, evidence, applications, outcomes, targetRoleId });
}

export async function refineCareerPlan(goal: CareerGoal, plan: CareerLearningPlan, evidence: CareerEvidence[]) {
  return jsonRequest<CareerLearningPlan & { warning?: string }>("/v1/ai/career-plan", { goal, plan, evidence });
}

export async function coachInterviewAnswer(question: string, answer: string, targetRoleId: string, targetRole: string, evidence: CareerEvidence[]) {
  return jsonRequest<CareerCoachFeedback & { warning?: string }>("/v1/ai/interview-coach", { question, answer, targetRoleId, targetRole, evidence });
}

export async function loadCareerState(token: string) {
  return authenticatedRequest<{ goal: CareerGoal | null; outcomes: CareerOutcome[]; plans: CareerLearningPlan[]; coaching: CareerCoachFeedback[] }>("/v1/career/state", token, "GET");
}

export async function saveCareerGoal(goal: CareerGoal, token: string) {
  return authenticatedRequest<{ goal: CareerGoal }>("/v1/career/goal", token, "PUT", goal);
}

export async function saveCareerOutcome(outcome: CareerOutcome, token: string) {
  return authenticatedRequest<{ outcome: CareerOutcome }>(`/v1/career/outcomes/${outcome.id}`, token, "PUT", outcome);
}

export async function saveCareerLearningPlan(plan: CareerLearningPlan, token: string) {
  return authenticatedRequest<{ plan: CareerLearningPlan }>(`/v1/career/plans/${plan.id}`, token, "PUT", plan);
}

export async function saveCareerCoachingSession(id: string, targetRoleId: string, feedback: CareerCoachFeedback, token: string) {
  return authenticatedRequest<{ feedback: CareerCoachFeedback }>("/v1/career/coaching-sessions", token, "POST", { id, targetRoleId, feedback });
}

export async function searchCareerMemoryRemotely(query: string, token: string) {
  return authenticatedRequest<{ items: CareerMemoryItem[]; query: string }>(`/v1/career/memory?q=${encodeURIComponent(query)}`, token, "GET");
}

export async function loadPortfolioPublication(token: string) {
  return authenticatedRequest<{ publication: PortfolioPublication | null }>("/v1/portfolio", token, "GET");
}

export async function savePortfolioPublication(publication: PortfolioPublication, token: string) {
  return authenticatedRequest<{ publication: PortfolioPublication; publicPortfolio: PublicPortfolio }>(`/v1/portfolio/${publication.id}`, token, "PUT", publication);
}

export async function loadPublicPortfolio(slug: string) {
  const response = await fetch(`${apiUrl}/v1/public/portfolios/${encodeURIComponent(slug)}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Portfolio not found");
  return payload as { portfolio: PublicPortfolio };
}

export type OrganizationSummary = Organization & { role: "owner" | "admin" | "coach" | "participant" };
export type OrganizationWorkspacePayload = {
  organization: OrganizationSummary;
  members: Array<{ organization_id: string; user_id: string; display_name: string; email: string; role: string; joined_at: string }>;
  grants: OrganizationDataGrant[];
  profiles: OrganizationParticipantProfile[];
  cohorts: Array<{ id: string; organization_id: string; name: string; created_at: string }>;
};

export async function loadOrganizations(token: string) {
  return authenticatedRequest<{ organizations: OrganizationSummary[] }>("/v1/organizations", token, "GET");
}

export async function createOrganization(input: Pick<Organization, "name" | "slug" | "type">, token: string) {
  return authenticatedRequest<{ organization: OrganizationSummary }>("/v1/organizations", token, "POST", input);
}

export async function loadOrganizationWorkspace(organizationId: string, token: string) {
  return authenticatedRequest<OrganizationWorkspacePayload>(`/v1/organizations/${organizationId}`, token, "GET");
}

export async function createOrganizationInvite(organizationId: string, input: { email: string; role: "admin" | "coach" | "participant"; expiresInDays: number }, token: string) {
  return authenticatedRequest<{ invitation: { id: string; email: string; role: string; expiresAt: string }; token: string }>(`/v1/organizations/${organizationId}/invites`, token, "POST", input);
}

export async function acceptOrganizationInvite(inviteToken: string, displayName: string, token: string) {
  return authenticatedRequest<{ organizationId: string; role: string }>("/v1/organization-invites/accept", token, "POST", { token: inviteToken, displayName });
}

export async function updateOrganizationGrant(organizationId: string, scopes: OrganizationDataGrant["scopes"], token: string) {
  return authenticatedRequest<{ grant: OrganizationDataGrant }>(`/v1/organizations/${organizationId}/grant`, token, "PUT", { scopes });
}

export async function saveOrganizationProfile(organizationId: string, profile: OrganizationParticipantProfile, token: string) {
  return authenticatedRequest<{ profile: OrganizationParticipantProfile }>(`/v1/organizations/${organizationId}/profile`, token, "PUT", profile);
}

export async function createOrganizationCohort(organizationId: string, name: string, token: string) {
  return authenticatedRequest<{ cohort: { id: string; organization_id: string; name: string; created_at: string } }>(`/v1/organizations/${organizationId}/cohorts`, token, "POST", { name });
}

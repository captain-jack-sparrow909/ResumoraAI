import { describe, expect, it } from "vitest";
import { analyzeResume, buildCareerIntelligence, buildCareerMemory, buildInterviewCoachFeedback, buildInterviewPrep, buildPublicPortfolio, checkProfileConsistency, demoApplications, demoCareerEvidence, demoResume, parseJobDescription, portfolioPublicationSchema, searchCareerMemory, scoreJobMatch, type CareerOutcome } from "./index";

describe("analyzeResume", () => {
  it("returns explainable component scores", () => {
    const analysis = analyzeResume(demoResume);
    expect(analysis.overall).toBeGreaterThan(80);
    expect(analysis.machineReadability).toBeGreaterThan(0);
    expect(analysis.findings.length).toBeGreaterThanOrEqual(7);
  });

  it("flags missing contact details", () => {
    const analysis = analyzeResume({
      ...demoResume,
      basics: { ...demoResume.basics, email: "", phone: "" },
    });
    expect(analysis.findings.find((item) => item.id === "contact")?.severity).toBe("critical");
  });
});

describe("Phase 4 career intelligence", () => {
  const outcomes: CareerOutcome[] = [{ id: "outcome-1", applicationId: "application-meridian", stage: "hiring_manager", result: "advanced", reasonTags: ["systems thinking"], notes: "Strong platform example", occurredAt: "2026-07-31T10:00:00.000Z", includeInInsights: true, createdAt: "2026-07-31T10:00:00.000Z" }];

  it("maps verified evidence to an explainable role readiness report", () => {
    const report = buildCareerIntelligence(demoResume, demoCareerEvidence, demoApplications, outcomes, "lead-product-designer");
    expect(report.targetRole.title).toBe("Lead Product Designer");
    expect(report.readiness).toBeGreaterThan(20);
    expect(report.skillSignals.some((signal) => signal.evidenceIds.length > 0)).toBe(true);
    expect(report.learningPlan.actions.every((action) => action.evidenceTarget.length > 20)).toBe(true);
  });

  it("retrieves relevant records from local career memory", () => {
    const memory = buildCareerMemory(demoResume, demoCareerEvidence, demoApplications, outcomes);
    const results = searchCareerMemory(memory, "design system");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((item) => /design system/i.test(`${item.title} ${item.content} ${item.skills.join(" ")}`))).toBe(true);
  });

  it("coaches an answer without introducing new evidence IDs", () => {
    const feedback = buildInterviewCoachFeedback("Tell me about a complex redesign", "First I researched the onboarding problem. Then I led the redesign across 14 customer segments, which reduced time-to-value by 38%. Finally, I documented what the six product squads needed to reuse the approach.", demoCareerEvidence, "lead-product-designer");
    expect(feedback.scores.structure).toBeGreaterThan(70);
    expect(feedback.scores.evidence).toBeGreaterThan(40);
    expect(feedback.evidenceIds.every((id) => demoCareerEvidence.some((item) => item.id === id))).toBe(true);
  });

  it.each([
    ["Workday", "Senior Platform Engineer\nRequired Qualifications\nKubernetes, Docker, AWS, and stakeholder management.\nPreferred Qualifications\nPostgreSQL and TypeScript.\nResponsibilities\nBuild reliable cloud platforms and lead architecture decisions."],
    ["Greenhouse", "Senior Product Designer\nWhat You'll Do\nLead customer research and build design systems.\nWhat You Bring\nFigma, user research, prototyping, stakeholder management.\nNice to Have\nAmplitude and A/B testing."],
    ["Lever", "Data Scientist\nTHE ROLE\nBuild machine learning models and conduct experiments.\nREQUIREMENTS\nPython, SQL, machine learning, data analysis.\nBONUS POINTS\nTableau and business strategy."],
  ])("keeps %s-style required and preferred sections separate", (_source, description) => {
    const analysis = parseJobDescription(description);
    expect(analysis.role.length).toBeGreaterThan(3);
    expect(analysis.requiredSkills.length).toBeGreaterThan(0);
    expect(analysis.requiredSkills.some((skill) => analysis.preferredSkills.includes(skill))).toBe(false);
  });
});

describe("Phase 4 publishing and organization boundaries", () => {
  it("publishes only explicitly selected, verified evidence", () => {
    const now = new Date().toISOString();
    const publication = portfolioPublicationSchema.parse({
      id: "portfolio-demo",
      slug: "maya-chen",
      displayName: "Maya Chen",
      headline: "Product designer building clearer enterprise systems",
      bio: "I turn complex workflows into measurable, accessible product experiences.",
      location: "Toronto, Canada",
      evidenceIds: [demoCareerEvidence[0].id, demoCareerEvidence[1].id, "not-approved"],
      featuredSkills: ["Product strategy", "Design systems"],
      theme: "editorial",
      showEmail: false,
      contactEmail: "maya@example.com",
      status: "published",
      publishedAt: now,
      updatedAt: now,
    });
    const portfolio = buildPublicPortfolio(publication, demoResume, [
      ...demoCareerEvidence,
      { ...demoCareerEvidence[0], id: "unverified-record", verified: false },
    ]);
    expect(portfolio.projects.map((project) => project.id)).toEqual(publication.evidenceIds.slice(0, 2));
    expect(portfolio.contactEmail).toBe("");
    expect(portfolio).not.toHaveProperty("phone");
  });

  it("requires URL-safe publication and organization slugs", () => {
    expect(portfolioPublicationSchema.safeParse({ id: "bad", slug: "Maya Chen!", displayName: "Maya", headline: "Designer", bio: "", evidenceIds: [], updatedAt: new Date().toISOString() }).success).toBe(false);
  });
});

describe("Phase 2 job intelligence", () => {
  const description = `
    Senior Product Designer
    You will lead customer research and build scalable design systems.
    Required qualifications: 6+ years of product design experience, Figma, user research, and stakeholder management.
    Preferred: Amplitude, analytics, and A/B testing.
    Own product strategy and collaborate with engineering and product management.
  `;

  it("extracts structured requirements from a job description", () => {
    const job = parseJobDescription(description);
    expect(job.role).toContain("Senior Product Designer");
    expect(job.seniority).toBe("senior");
    expect(job.requiredSkills).toContain("Figma");
    expect(job.preferredSkills).toContain("Amplitude");
    expect(job.requiredSkills).not.toContain("Amplitude");
    expect(job.keywords.length).toBeGreaterThan(3);
  });

  it("builds an explainable match report from resume and evidence", () => {
    const report = scoreJobMatch(demoResume, parseJobDescription(description), demoCareerEvidence);
    expect(report.overall).toBeGreaterThan(40);
    expect(report.matchedRequired).toContain("Figma");
    expect(report.evidenceIds.length).toBeGreaterThan(0);
    expect(report.analyzedAt).toBeTruthy();
  });

  it("builds evidence-linked interview preparation", () => {
    const application = demoApplications.find((item) => item.job);
    const pack = buildInterviewPrep(application!.id, application!.job!, demoCareerEvidence);
    expect(pack.questions).toHaveLength(6);
    expect(pack.questions.some((question) => question.evidenceIds.length > 0)).toBe(true);
    expect(pack.questionsForInterviewer.length).toBeGreaterThan(2);
  });

  it("finds cross-profile identity, role, date, and skill inconsistencies", () => {
    const report = checkProfileConsistency(demoResume, `
      Maya Chen — Senior Product Designer
      Northstar Labs, Senior Product Designer, 2022–Present
      Arc Commerce, Product Designer, 2018–2022
      Product strategy, User research, Figma, Design systems, Prototyping, Amplitude
    `);
    expect(report.overall).toBeGreaterThan(60);
    expect(report.findings.some((finding) => finding.category === "dates")).toBe(true);
    expect(report.findings.find((finding) => finding.id === "identity-name")?.severity).toBe("aligned");
  });
});

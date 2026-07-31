import { describe, expect, it } from "vitest";
import { analyzeResume, demoCareerEvidence, demoResume, parseJobDescription, scoreJobMatch } from "./index";

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
});

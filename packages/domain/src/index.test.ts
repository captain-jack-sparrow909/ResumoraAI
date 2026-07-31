import { describe, expect, it } from "vitest";
import { analyzeResume, demoResume } from "./index";

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

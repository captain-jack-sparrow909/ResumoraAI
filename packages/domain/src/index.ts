import { z } from "zod";

export const linkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

export const experienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  current: z.boolean().default(false),
  bullets: z.array(z.string()),
});

export const educationSchema = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string(),
});

export const skillGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(z.string()),
});

export const resumeSchema = z.object({
  id: z.string(),
  title: z.string(),
  template: z.enum(["slate", "linear", "meridian", "executive", "compact"]),
  basics: z.object({
    fullName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    links: z.array(linkSchema),
  }),
  summary: z.string(),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  skills: z.array(skillGroupSchema),
  updatedAt: z.string(),
});

export type ResumeDocument = z.infer<typeof resumeSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;

export type AnalysisFinding = {
  id: string;
  category: "readability" | "content" | "completeness";
  severity: "pass" | "improve" | "critical";
  title: string;
  explanation: string;
  field?: string;
  points: number;
};

export type ResumeAnalysis = {
  overall: number;
  machineReadability: number;
  recruiterQuality: number;
  completeness: number;
  findings: AnalysisFinding[];
  analyzedAt: string;
};

const actionVerbs = [
  "accelerated", "achieved", "built", "created", "delivered", "designed",
  "developed", "drove", "grew", "implemented", "improved", "increased",
  "launched", "led", "managed", "optimized", "reduced", "scaled", "shipped",
  "streamlined",
];

const makeFinding = (
  id: string,
  category: AnalysisFinding["category"],
  severity: AnalysisFinding["severity"],
  title: string,
  explanation: string,
  points: number,
  field?: string,
): AnalysisFinding => ({ id, category, severity, title, explanation, field, points });

export function analyzeResume(resume: ResumeDocument): ResumeAnalysis {
  const findings: AnalysisFinding[] = [];
  const allBullets = resume.experience.flatMap((item) => item.bullets).filter(Boolean);
  const quantified = allBullets.filter((bullet) => /\b\d+(?:[.,]\d+)?(?:%|\+|x|k|m|b)?\b/i.test(bullet));
  const actionLed = allBullets.filter((bullet) =>
    actionVerbs.some((verb) => bullet.trim().toLowerCase().startsWith(verb)),
  );
  const longBullets = allBullets.filter((bullet) => bullet.length > 180);

  const contactComplete = Boolean(resume.basics.fullName && resume.basics.email && resume.basics.phone);
  findings.push(
    contactComplete
      ? makeFinding("contact", "readability", "pass", "Contact details are machine-readable", "Name, email, and phone are present in the document body.", 15, "basics")
      : makeFinding("contact", "readability", "critical", "Complete your contact details", "Add a name, professional email, and phone number so recruiters and parsers can identify you.", 0, "basics"),
  );

  const hasCoreSections = Boolean(resume.summary && resume.experience.length && resume.education.length && resume.skills.length);
  findings.push(
    hasCoreSections
      ? makeFinding("sections", "completeness", "pass", "Core sections are present", "Summary, experience, education, and skills are included.", 20)
      : makeFinding("sections", "completeness", "critical", "Add the missing core sections", "Most recruiters expect summary, experience, education, and skills.", 0),
  );

  const summaryGood = resume.summary.length >= 180 && resume.summary.length <= 520;
  findings.push(
    summaryGood
      ? makeFinding("summary", "content", "pass", "Summary has useful depth", "Your summary is concise enough to scan and detailed enough to establish fit.", 15, "summary")
      : makeFinding("summary", "content", "improve", "Refine the summary length", "Aim for roughly 35–80 words focused on seniority, specialization, and evidence of impact.", 6, "summary"),
  );

  const quantRatio = allBullets.length ? quantified.length / allBullets.length : 0;
  findings.push(
    quantRatio >= 0.5
      ? makeFinding("impact", "content", "pass", "Achievements show measurable impact", `${quantified.length} of ${allBullets.length} bullets include concrete scope or outcomes.`, 20, "experience")
      : makeFinding("impact", "content", "improve", "Add evidence of impact", "Add scale, time, money, quality, or growth metrics where they are truthful and defensible.", Math.round(20 * quantRatio), "experience"),
  );

  const actionRatio = allBullets.length ? actionLed.length / allBullets.length : 0;
  findings.push(
    actionRatio >= 0.7
      ? makeFinding("verbs", "content", "pass", "Bullets lead with strong actions", "Most experience bullets begin with clear, specific action verbs.", 15, "experience")
      : makeFinding("verbs", "content", "improve", "Strengthen bullet openings", "Start bullets with precise actions such as built, led, improved, reduced, or launched.", Math.round(15 * actionRatio), "experience"),
  );

  findings.push(
    longBullets.length === 0
      ? makeFinding("length", "readability", "pass", "Bullets are easy to scan", "No bullet exceeds the recommended scan length.", 15, "experience")
      : makeFinding("length", "readability", "improve", "Shorten long bullets", `${longBullets.length} bullet${longBullets.length === 1 ? " is" : "s are"} longer than 180 characters.`, Math.max(0, 15 - longBullets.length * 4), "experience"),
  );

  const skillsCount = resume.skills.reduce((count, group) => count + group.items.length, 0);
  findings.push(
    skillsCount >= 8
      ? makeFinding("skills", "completeness", "pass", "Skills provide searchable context", `${skillsCount} skills are expressed as text, not graphics.`, 15, "skills")
      : makeFinding("skills", "completeness", "improve", "Add relevant hard skills", "Include at least eight defensible role-specific skills as plain text.", Math.min(14, skillsCount), "skills"),
  );

  const scoreFor = (category: AnalysisFinding["category"], maximum: number) => {
    const earned = findings.filter((item) => item.category === category).reduce((sum, item) => sum + item.points, 0);
    const possible = findings.filter((item) => item.category === category).reduce((sum, item) => sum + ({ contact: 15, sections: 20, summary: 15, impact: 20, verbs: 15, length: 15, skills: 15 }[item.id] ?? 0), 0);
    return possible ? Math.min(100, Math.round((earned / possible) * 100)) : maximum;
  };

  const machineReadability = scoreFor("readability", 100);
  const recruiterQuality = scoreFor("content", 100);
  const completeness = scoreFor("completeness", 100);

  return {
    overall: Math.round(machineReadability * 0.35 + recruiterQuality * 0.4 + completeness * 0.25),
    machineReadability,
    recruiterQuality,
    completeness,
    findings,
    analyzedAt: new Date().toISOString(),
  };
}

export const demoResume: ResumeDocument = {
  id: "resume-demo",
  title: "Senior Product Designer — Core",
  template: "slate",
  basics: {
    fullName: "Maya Chen",
    headline: "Senior Product Designer",
    email: "maya.chen@example.com",
    phone: "+971 50 555 0192",
    location: "Dubai, UAE",
    links: [
      { label: "Portfolio", url: "mayachen.design" },
      { label: "LinkedIn", url: "linkedin.com/in/mayachen" },
    ],
  },
  summary: "Product designer with 8+ years of experience turning complex B2B workflows into calm, high-converting products. Combines customer research, systems thinking, and hands-on craft to align teams and ship measurable improvements across the full product lifecycle.",
  experience: [
    {
      id: "exp-1",
      company: "Northstar Labs",
      role: "Senior Product Designer",
      location: "Dubai, UAE",
      startDate: "2022-03",
      endDate: "Present",
      current: true,
      bullets: [
        "Led the redesign of the enterprise onboarding journey, reducing time-to-value by 38% across 14 customer segments.",
        "Built a shared research repository and monthly insight ritual used by 6 product squads to prioritize roadmap decisions.",
        "Designed and launched a modular design system that cut feature delivery time by 24% while improving accessibility coverage.",
      ],
    },
    {
      id: "exp-2",
      company: "Arc Commerce",
      role: "Product Designer",
      location: "Singapore",
      startDate: "2018-07",
      endDate: "2022-02",
      current: false,
      bullets: [
        "Improved checkout completion by 17% through mixed-method research and iterative experimentation across web and mobile.",
        "Facilitated discovery workshops with product, engineering, and operations leaders across three regional markets.",
      ],
    },
  ],
  education: [
    {
      id: "edu-1",
      institution: "National University of Singapore",
      degree: "Bachelor of Arts",
      field: "Industrial Design",
      startDate: "2014",
      endDate: "2018",
      location: "Singapore",
    },
  ],
  skills: [
    { id: "skill-1", name: "Product", items: ["Product strategy", "User research", "Interaction design", "Prototyping", "Design systems"] },
    { id: "skill-2", name: "Tools", items: ["Figma", "FigJam", "Maze", "Amplitude", "Jira"] },
  ],
  updatedAt: new Date().toISOString(),
};

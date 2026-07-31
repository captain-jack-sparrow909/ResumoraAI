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
  sourceResumeId: z.string().optional(),
  targetJobId: z.string().optional(),
  variantType: z.enum(["base", "targeted"]).default("base"),
  updatedAt: z.string(),
});

export type ResumeDocument = z.infer<typeof resumeSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;

export const careerEvidenceSchema = z.object({
  id: z.string(),
  type: z.enum(["achievement", "responsibility", "project", "skill", "certification", "education"]),
  title: z.string(),
  organization: z.string().default(""),
  description: z.string(),
  skills: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
  date: z.string().default(""),
  verified: z.boolean().default(true),
  source: z.enum(["user", "resume_import", "ai_extracted"]).default("user"),
});

export const jobAnalysisSchema = z.object({
  role: z.string(),
  company: z.string().default(""),
  seniority: z.enum(["internship", "junior", "mid", "senior", "lead", "executive", "unknown"]),
  summary: z.string(),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  qualifications: z.array(z.string()),
  keywords: z.array(z.string()),
});

export const jobPostingSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string().default(""),
  description: z.string(),
  analysis: jobAnalysisSchema,
  createdAt: z.string(),
});

export type CareerEvidence = z.infer<typeof careerEvidenceSchema>;
export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
export type JobPosting = z.infer<typeof jobPostingSchema>;

export type MatchGap = {
  term: string;
  kind: "required" | "preferred";
  severity: "critical" | "improve";
  guidance: string;
};

export type JobMatchReport = {
  overall: number;
  hardSkills: number;
  keywordCoverage: number;
  evidenceStrength: number;
  experienceAlignment: number;
  matchedRequired: string[];
  missingRequired: string[];
  matchedPreferred: string[];
  missingPreferred: string[];
  evidenceIds: string[];
  gaps: MatchGap[];
  analyzedAt: string;
};

export const tailoringProposalSchema = z.object({
  id: z.string(),
  target: z.enum(["headline", "summary", "experience_bullet"]),
  experienceId: z.string().optional(),
  bulletIndex: z.number().int().nonnegative().optional(),
  original: z.string(),
  suggestion: z.string(),
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
  addedKeywords: z.array(z.string()),
  unsupportedClaims: z.array(z.string()),
});

export type TailoringProposal = z.infer<typeof tailoringProposalSchema>;

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
  variantType: "base",
  updatedAt: new Date().toISOString(),
};

const knownSkills = [
  "A/B testing", "Agile", "Amplitude", "analytics", "AWS", "Azure", "business strategy",
  "change management", "communication", "customer research", "data analysis", "design systems",
  "Docker", "Figma", "financial modeling", "Git", "Google Analytics", "GraphQL", "Java",
  "JavaScript", "Jira", "Kubernetes", "leadership", "machine learning", "market research",
  "Next.js", "Node.js", "operations", "PostgreSQL", "product design", "product management",
  "product strategy", "project management", "prototyping", "Python", "React", "roadmapping",
  "sales", "Scrum", "SQL", "stakeholder management", "strategy", "Supabase", "Tableau",
  "team management", "TypeScript", "user research", "UX design", "visual design",
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
const unique = (items: string[]) => [...new Map(items.filter(Boolean).map((item) => [normalize(item), item.trim()])).values()];

export function parseJobDescription(description: string): JobAnalysis {
  const rawLines = description.split(/\r?\n/).map((line) => line.replace(/^[\s•*\-–—]+/, "").trim()).filter(Boolean);
  const lower = description.toLowerCase();
  const roleLine = rawLines.find((line) => /(?:designer|engineer|manager|director|developer|analyst|consultant|specialist|lead|officer|architect|recruiter|marketer)/i.test(line) && line.length < 110);
  const role = roleLine?.replace(/^(job title|position|role)\s*[:\-]\s*/i, "") ?? rawLines[0]?.slice(0, 100) ?? "Target role";
  const seniority: JobAnalysis["seniority"] = /\b(chief|vp|vice president|executive|head of)\b/i.test(role)
    ? "executive"
    : /\b(principal|staff|lead)\b/i.test(role)
      ? "lead"
      : /\b(senior|sr\.)\b/i.test(role)
        ? "senior"
        : /\b(junior|jr\.|entry.level|graduate)\b/i.test(role)
          ? "junior"
          : /\b(intern|internship)\b/i.test(role)
            ? "internship"
            : "mid";

  const foundSkills = knownSkills.filter((skill) => lower.includes(skill.toLowerCase()));
  const categorized = rawLines.reduce<{ section: "required" | "preferred" | "responsibilities" | null; required: string[]; preferred: string[] }>((state, line) => {
    const requiredHeading = /^(required(?: qualifications?| skills?)?|requirements?|minimum qualifications?|what you bring)\s*:?(.*)$/i.exec(line);
    const preferredHeading = /^(preferred(?: qualifications?| skills?)?|nice to have|bonus(?: points)?|ideally)\s*:?(.*)$/i.exec(line);
    const responsibilityHeading = /^(responsibilities|what you(?:'|’)ll do|what you will do|the role)\s*:?(.*)$/i.exec(line);
    if (requiredHeading) {
      state.section = "required";
      if (requiredHeading[2]?.trim()) state.required.push(requiredHeading[2].trim());
      return state;
    }
    if (preferredHeading) {
      state.section = "preferred";
      if (preferredHeading[2]?.trim()) state.preferred.push(preferredHeading[2].trim());
      return state;
    }
    if (responsibilityHeading) {
      state.section = "responsibilities";
      return state;
    }
    if (state.section === "required") state.required.push(line);
    if (state.section === "preferred") state.preferred.push(line);
    return state;
  }, { section: null, required: [], preferred: [] });
  const explicitlyRequired = rawLines.filter((line) => /\b(must|required|minimum|you have)\b/i.test(line));
  const explicitlyPreferred = rawLines.filter((line) => /\b(preferred|ideally|nice to have|bonus|plus)\b/i.test(line));
  const requiredLines = unique([...categorized.required, ...explicitlyRequired]);
  const preferredLines = unique([...categorized.preferred, ...explicitlyPreferred]);
  const requiredSkills = foundSkills.filter((skill) => requiredLines.some((line) => line.toLowerCase().includes(skill.toLowerCase())));
  const preferredSkills = foundSkills.filter((skill) => preferredLines.some((line) => line.toLowerCase().includes(skill.toLowerCase())));
  const uncategorized = foundSkills.filter((skill) => !requiredSkills.includes(skill) && !preferredSkills.includes(skill));
  const responsibilities = rawLines
    .filter((line) => /^(lead|build|create|design|develop|drive|manage|own|partner|collaborate|deliver|define|conduct|support|work|translate|establish|improve)\b/i.test(line))
    .slice(0, 8);
  const qualifications = unique([...requiredLines, ...preferredLines]).slice(0, 8);
  const titleKeywords = role.split(/\s+/).filter((word) => word.length > 3 && !/^(senior|junior|lead|the|and|for)$/i.test(word));

  return {
    role,
    company: "",
    seniority,
    summary: responsibilities.slice(0, 2).join(" ") || rawLines.slice(1, 3).join(" ").slice(0, 360),
    requiredSkills: unique(requiredSkills.length ? requiredSkills : uncategorized.slice(0, 8)),
    preferredSkills: unique(preferredSkills),
    responsibilities,
    qualifications,
    keywords: unique([...foundSkills, ...titleKeywords]).slice(0, 20),
  };
}

const includesTerm = (haystack: string, term: string) => normalize(haystack).includes(normalize(term));

export function scoreJobMatch(resume: ResumeDocument, job: JobAnalysis, evidence: CareerEvidence[]): JobMatchReport {
  const resumeText = [
    resume.basics.headline,
    resume.summary,
    ...resume.skills.flatMap((group) => group.items),
    ...resume.experience.flatMap((item) => [item.role, item.company, ...item.bullets]),
  ].join(" ");
  const evidenceText = evidence.map((item) => [item.title, item.description, ...item.skills, ...item.metrics].join(" "));
  const combinedText = `${resumeText} ${evidenceText.join(" ")}`;

  const matchedRequired = job.requiredSkills.filter((skill) => includesTerm(combinedText, skill));
  const missingRequired = job.requiredSkills.filter((skill) => !matchedRequired.includes(skill));
  const matchedPreferred = job.preferredSkills.filter((skill) => includesTerm(combinedText, skill));
  const missingPreferred = job.preferredSkills.filter((skill) => !matchedPreferred.includes(skill));
  const matchedKeywords = job.keywords.filter((keyword) => includesTerm(combinedText, keyword));
  const supportingEvidence = evidence.filter((item) =>
    [...matchedRequired, ...matchedPreferred].some((skill) => includesTerm(`${item.title} ${item.description} ${item.skills.join(" ")}`, skill)),
  );

  const hardSkills = job.requiredSkills.length ? Math.round((matchedRequired.length / job.requiredSkills.length) * 100) : 80;
  const keywordCoverage = job.keywords.length ? Math.round((matchedKeywords.length / job.keywords.length) * 100) : 80;
  const targetTokens = normalize(job.role).split(" ").filter((word) => word.length > 3);
  const titleHits = targetTokens.filter((token) => includesTerm(resume.basics.headline, token)).length;
  const experienceAlignment = targetTokens.length ? Math.min(100, Math.round((titleHits / targetTokens.length) * 65 + hardSkills * 0.35)) : hardSkills;
  const evidenceStrength = matchedRequired.length
    ? Math.min(100, Math.round((supportingEvidence.length / matchedRequired.length) * 85 + supportingEvidence.filter((item) => item.metrics.length).length * 8))
    : evidence.length ? 75 : 25;
  const overall = Math.round(hardSkills * 0.4 + keywordCoverage * 0.2 + evidenceStrength * 0.25 + experienceAlignment * 0.15);

  return {
    overall,
    hardSkills,
    keywordCoverage,
    evidenceStrength,
    experienceAlignment,
    matchedRequired,
    missingRequired,
    matchedPreferred,
    missingPreferred,
    evidenceIds: supportingEvidence.map((item) => item.id),
    gaps: [
      ...missingRequired.map((term): MatchGap => ({ term, kind: "required", severity: "critical", guidance: `Add ${term} only if your Career Vault contains defensible evidence for it.` })),
      ...missingPreferred.map((term): MatchGap => ({ term, kind: "preferred", severity: "improve", guidance: `Consider surfacing verified ${term} experience if it is relevant.` })),
    ],
    analyzedAt: new Date().toISOString(),
  };
}

export const demoCareerEvidence: CareerEvidence[] = [
  {
    id: "evidence-onboarding",
    type: "achievement",
    title: "Enterprise onboarding redesign",
    organization: "Northstar Labs",
    description: "Led research and interaction design for a redesigned enterprise onboarding journey across fourteen customer segments.",
    skills: ["User research", "Product strategy", "Interaction design"],
    metrics: ["38% reduction in time-to-value", "14 customer segments"],
    date: "2024",
    verified: true,
    source: "user",
  },
  {
    id: "evidence-system",
    type: "project",
    title: "Modular design system",
    organization: "Northstar Labs",
    description: "Designed and launched a shared design system with reusable components and accessibility guidance.",
    skills: ["Design systems", "Figma", "Accessibility", "Stakeholder management"],
    metrics: ["24% faster feature delivery", "6 product squads"],
    date: "2023",
    verified: true,
    source: "user",
  },
  {
    id: "evidence-checkout",
    type: "achievement",
    title: "Checkout conversion program",
    organization: "Arc Commerce",
    description: "Used mixed-method customer research, analytics, and iterative prototyping to improve checkout completion across web and mobile.",
    skills: ["Customer research", "Prototyping", "Analytics", "A/B testing"],
    metrics: ["17% increase in checkout completion", "3 regional markets"],
    date: "2021",
    verified: true,
    source: "resume_import",
  },
];

export const applicationStatusSchema = z.enum([
  "saved",
  "preparing",
  "applied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]);

export const applicationCoverLetterSchema = z.object({
  subject: z.string(),
  letter: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  model: z.string().default(""),
});

export const applicationSchema = z.object({
  id: z.string(),
  jobId: z.string().optional(),
  role: z.string(),
  company: z.string().default(""),
  location: z.string().default(""),
  sourceUrl: z.string().default(""),
  status: applicationStatusSchema.default("saved"),
  matchScore: z.number().int().min(0).max(100).default(0),
  resumeId: z.string().optional(),
  coverLetterId: z.string().optional(),
  coverLetter: applicationCoverLetterSchema.optional(),
  notes: z.string().default(""),
  nextAction: z.string().default(""),
  nextActionAt: z.string().nullable().default(null),
  appliedAt: z.string().nullable().default(null),
  job: jobAnalysisSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const applicationActivitySchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  kind: z.enum(["created", "status", "note", "asset", "interview", "review"]),
  message: z.string(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
});

export const interviewQuestionSchema = z.object({
  id: z.string(),
  category: z.enum(["role", "behavioral", "technical", "leadership", "company"]),
  question: z.string(),
  whyAsked: z.string(),
  answerFramework: z.string(),
  evidenceIds: z.array(z.string()).default([]),
});

export const interviewPackSchema = z.object({
  applicationId: z.string(),
  questions: z.array(interviewQuestionSchema).max(12),
  themes: z.array(z.string()).max(12),
  questionsForInterviewer: z.array(z.string()).max(8),
  model: z.string(),
  generatedAt: z.string(),
});

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type JobApplication = z.infer<typeof applicationSchema>;
export type ApplicationActivity = z.infer<typeof applicationActivitySchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewPack = z.infer<typeof interviewPackSchema>;

export const activeApplicationStatuses: ApplicationStatus[] = ["saved", "preparing", "applied", "interview", "offer"];

export function buildInterviewPrep(applicationId: string, job: JobAnalysis, evidence: CareerEvidence[]): InterviewPack {
  const verified = evidence.filter((item) => item.verified);
  const evidenceFor = (terms: string[]) => verified
    .filter((item) => terms.some((term) => includesTerm(`${item.title} ${item.description} ${item.skills.join(" ")}`, term)))
    .map((item) => item.id)
    .slice(0, 3);
  const leadResponsibility = job.responsibilities[0] ?? `deliver strong outcomes as ${job.role}`;
  const keySkill = job.requiredSkills[0] ?? job.keywords[0] ?? "your core discipline";
  const secondSkill = job.requiredSkills[1] ?? job.preferredSkills[0] ?? "cross-functional collaboration";
  const questions: InterviewQuestion[] = [
    {
      id: "interview-role-impact",
      category: "role",
      question: `Tell me about a project that best demonstrates your readiness to ${leadResponsibility.toLowerCase()}`,
      whyAsked: "Connects your strongest verified outcome to the role's highest-priority responsibility.",
      answerFramework: "Situation → your exact responsibility → decisions you made → measurable result → what you learned.",
      evidenceIds: evidenceFor([keySkill, ...job.keywords.slice(0, 3)]),
    },
    {
      id: "interview-skill-depth",
      category: "technical",
      question: `Walk me through how you apply ${keySkill} when the problem is ambiguous.`,
      whyAsked: `Tests practical depth in a required capability: ${keySkill}.`,
      answerFramework: "Clarify the constraint → explain your method → show a tradeoff → cite an outcome.",
      evidenceIds: evidenceFor([keySkill]),
    },
    {
      id: "interview-collaboration",
      category: "behavioral",
      question: `Describe a time you used ${secondSkill} to resolve disagreement or unblock delivery.`,
      whyAsked: "Evaluates how you work across functions, not only the quality of the final output.",
      answerFramework: "Name the disagreement → show how you listened → explain the decision mechanism → quantify the result.",
      evidenceIds: evidenceFor([secondSkill, "stakeholder management", "leadership"]),
    },
    {
      id: "interview-failure",
      category: "behavioral",
      question: "Tell me about a decision that did not work as expected. What changed in your approach afterward?",
      whyAsked: "Tests judgment, accountability, and learning without rewarding a disguised success story.",
      answerFramework: "Own the decision → state the missed signal → explain the correction → show the lasting change.",
      evidenceIds: verified.slice(0, 2).map((item) => item.id),
    },
    {
      id: "interview-leadership",
      category: "leadership",
      question: `How would you create alignment around ${job.responsibilities[1]?.toLowerCase() ?? `the priorities of this ${job.role} role`}?`,
      whyAsked: "Reveals how you turn incomplete information into an executable team decision.",
      answerFramework: "Stakeholders → evidence needed → decision criteria → communication rhythm → success measure.",
      evidenceIds: evidenceFor(["leadership", "stakeholder management", "strategy"]),
    },
    {
      id: "interview-first-90",
      category: "company",
      question: `What would you want to understand in your first 30 days as ${job.role}?`,
      whyAsked: "Tests preparation, prioritization, and whether you ask before prescribing.",
      answerFramework: "People → customers → product/system → success measures → first low-risk contribution.",
      evidenceIds: [],
    },
  ];
  return {
    applicationId,
    questions,
    themes: unique([keySkill, secondSkill, ...job.requiredSkills, ...job.responsibilities.slice(0, 3)]).slice(0, 8),
    questionsForInterviewer: [
      "What outcomes would make this hire an exceptional success after six months?",
      `Where does ${job.requiredSkills[0] ?? "this role's core work"} currently create the most friction for the team?`,
      "How are important cross-functional decisions made when priorities conflict?",
      "What has changed about this role since the last person held it?",
    ],
    model: "deterministic",
    generatedAt: new Date().toISOString(),
  };
}

const demoPlatformJob = parseJobDescription(`Senior Product Designer — Platform
Responsibilities
Lead customer research and shape complex B2B workflows. Build an accessible design system with engineering.
Required qualifications
Figma, user research, prototyping, design systems, and stakeholder management.
Preferred qualifications
Amplitude and A/B testing.`);

export const demoApplications: JobApplication[] = [
  {
    id: "application-atlas",
    jobId: "job-atlas-platform",
    role: "Senior Product Designer — Platform",
    company: "Atlas",
    location: "Dubai · Hybrid",
    sourceUrl: "",
    status: "preparing",
    matchScore: 87,
    resumeId: "resume-demo",
    notes: "Emphasize enterprise workflows and multi-team design-system adoption.",
    nextAction: "Review tailored resume and submit",
    nextActionAt: "2026-08-03T09:00:00.000Z",
    appliedAt: null,
    job: { ...demoPlatformJob, company: "Atlas" },
    createdAt: "2026-07-30T10:00:00.000Z",
    updatedAt: "2026-07-31T17:30:00.000Z",
  },
  {
    id: "application-lumon",
    role: "Lead Product Designer",
    company: "Lumon Health",
    location: "Remote",
    sourceUrl: "",
    status: "applied",
    matchScore: 81,
    resumeId: "resume-demo",
    coverLetterId: "cover-lumon",
    notes: "Referral from Priya. Portfolio case study sent with application.",
    nextAction: "Follow up with recruiter",
    nextActionAt: "2026-08-05T08:00:00.000Z",
    appliedAt: "2026-07-29T12:00:00.000Z",
    createdAt: "2026-07-27T09:00:00.000Z",
    updatedAt: "2026-07-29T12:00:00.000Z",
  },
  {
    id: "application-meridian",
    role: "Principal Product Designer",
    company: "Meridian Cloud",
    location: "Abu Dhabi · Hybrid",
    sourceUrl: "",
    status: "interview",
    matchScore: 91,
    resumeId: "resume-demo",
    coverLetterId: "cover-meridian",
    notes: "Hiring-manager conversation focused on platform strategy and mentoring.",
    nextAction: "Prepare product critique interview",
    nextActionAt: "2026-08-02T11:30:00.000Z",
    appliedAt: "2026-07-22T10:00:00.000Z",
    job: { ...demoPlatformJob, role: "Principal Product Designer", company: "Meridian Cloud", seniority: "lead" },
    createdAt: "2026-07-18T08:30:00.000Z",
    updatedAt: "2026-07-31T13:20:00.000Z",
  },
  {
    id: "application-northstar",
    role: "Staff Product Designer",
    company: "Northstar Finance",
    location: "London · Remote",
    sourceUrl: "",
    status: "saved",
    matchScore: 76,
    notes: "Research visa and working-hours expectations before tailoring.",
    nextAction: "Review location requirements",
    nextActionAt: null,
    appliedAt: null,
    createdAt: "2026-07-31T15:00:00.000Z",
    updatedAt: "2026-07-31T15:00:00.000Z",
  },
];

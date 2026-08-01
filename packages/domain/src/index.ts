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

export const documentLanguageSchema = z.enum(["en", "ar", "fr", "es", "de", "pt"]);
export const documentDirectionSchema = z.enum(["ltr", "rtl"]);

export const resumeSchema = z.object({
  id: z.string(),
  title: z.string(),
  template: z.enum(["slate", "linear", "meridian", "executive", "compact"]),
  language: documentLanguageSchema.default("en"),
  direction: documentDirectionSchema.default("ltr"),
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
export type DocumentLanguage = z.infer<typeof documentLanguageSchema>;
export type DocumentDirection = z.infer<typeof documentDirectionSchema>;

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
  language: "en",
  direction: "ltr",
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

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu, " ").trim();
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

export const reviewTargetSchema = z.enum(["application", "resume", "cover_letter"]);
export const reviewDecisionSchema = z.enum(["comment", "approved", "changes_requested"]);

export const applicationReviewInviteSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  reviewerName: z.string().default(""),
  reviewerEmail: z.string().email(),
  role: z.enum(["mentor", "reviewer", "hiring_coach"]).default("reviewer"),
  target: reviewTargetSchema,
  expiresAt: z.string(),
  revokedAt: z.string().nullable().default(null),
  acceptedAt: z.string().nullable().default(null),
  createdAt: z.string(),
});

export const applicationReviewSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  inviteId: z.string().nullable().default(null),
  authorName: z.string(),
  target: reviewTargetSchema,
  body: z.string(),
  decision: reviewDecisionSchema.default("comment"),
  status: z.enum(["open", "resolved"]).default("open"),
  createdAt: z.string(),
  resolvedAt: z.string().nullable().default(null),
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
export type ApplicationReviewInvite = z.infer<typeof applicationReviewInviteSchema>;
export type ApplicationReview = z.infer<typeof applicationReviewSchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewPack = z.infer<typeof interviewPackSchema>;

export type ProfileConsistencyFinding = {
  id: string;
  category: "identity" | "headline" | "experience" | "skills" | "dates";
  severity: "aligned" | "review" | "missing";
  title: string;
  explanation: string;
};

export type ProfileConsistencyReport = {
  overall: number;
  aligned: number;
  review: number;
  missing: number;
  findings: ProfileConsistencyFinding[];
  checkedAt: string;
};

export function checkProfileConsistency(resume: ResumeDocument, profileText: string): ProfileConsistencyReport {
  const profile = normalize(profileText);
  const findings: ProfileConsistencyFinding[] = [];
  const add = (finding: ProfileConsistencyFinding) => findings.push(finding);
  const isPresent = (value: string) => Boolean(value.trim()) && profile.includes(normalize(value));

  add(isPresent(resume.basics.fullName)
    ? { id: "identity-name", category: "identity", severity: "aligned", title: "Name is aligned", explanation: "The same name appears in both documents." }
    : { id: "identity-name", category: "identity", severity: "review", title: "Check the displayed name", explanation: "Your resume name was not found in the profile text. Confirm spelling and preferred-name formatting." });

  add(isPresent(resume.basics.headline)
    ? { id: "headline", category: "headline", severity: "aligned", title: "Headline is aligned", explanation: "The professional headline is consistent." }
    : { id: "headline", category: "headline", severity: "review", title: "Headline differs", explanation: "Align role and seniority wording where truthful; small positioning differences can be intentional." });

  for (const experience of resume.experience) {
    const companyPresent = isPresent(experience.company);
    const rolePresent = isPresent(experience.role);
    add({
      id: `experience-${experience.id}`,
      category: "experience",
      severity: companyPresent && rolePresent ? "aligned" : companyPresent || rolePresent ? "review" : "missing",
      title: companyPresent && rolePresent ? `${experience.company} is aligned` : `Check ${experience.company || experience.role}`,
      explanation: companyPresent && rolePresent
        ? "Employer and role appear in both documents."
        : companyPresent || rolePresent
          ? "Only the employer or role matched. Confirm title wording without inflating seniority."
          : "This resume position was not found in the pasted profile text.",
    });

    const dates = [experience.startDate.slice(0, 4), experience.current ? "" : experience.endDate.slice(0, 4)].filter(Boolean);
    if (dates.length) add({
      id: `dates-${experience.id}`,
      category: "dates",
      severity: dates.every((date) => profile.includes(date)) ? "aligned" : "review",
      title: dates.every((date) => profile.includes(date)) ? `${experience.company} dates appear aligned` : `Review ${experience.company} dates`,
      explanation: dates.every((date) => profile.includes(date)) ? "The resume years appear in the profile." : "One or more resume years were not found. Check for timeline discrepancies or different date precision.",
    });
  }

  const skills = unique(resume.skills.flatMap((group) => group.items));
  const missingSkills = skills.filter((skill) => !isPresent(skill));
  add({
    id: "skills",
    category: "skills",
    severity: missingSkills.length <= Math.max(2, Math.floor(skills.length * 0.3)) ? "aligned" : "review",
    title: missingSkills.length ? `${skills.length - missingSkills.length} of ${skills.length} resume skills appear in the profile` : "Skills are aligned",
    explanation: missingSkills.length ? `Consider adding relevant, defensible skills to the profile: ${missingSkills.slice(0, 6).join(", ")}.` : "The searchable skill vocabulary is consistent.",
  });

  const weights = { aligned: 1, review: 0.45, missing: 0 } as const;
  const overall = findings.length ? Math.round(findings.reduce((sum, item) => sum + weights[item.severity], 0) / findings.length * 100) : 0;
  return {
    overall,
    aligned: findings.filter((item) => item.severity === "aligned").length,
    review: findings.filter((item) => item.severity === "review").length,
    missing: findings.filter((item) => item.severity === "missing").length,
    findings,
    checkedAt: new Date().toISOString(),
  };
}

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

export const careerGoalSchema = z.object({
  targetRoleId: z.string(),
  targetTitle: z.string(),
  horizonMonths: z.number().int().min(1).max(36).default(12),
  weeklyHours: z.number().int().min(1).max(30).default(5),
  priorities: z.array(z.string()).max(8).default([]),
  updatedAt: z.string(),
});

export const careerOutcomeSchema = z.object({
  id: z.string(),
  applicationId: z.string().optional(),
  stage: z.enum(["application", "recruiter_screen", "hiring_manager", "assessment", "onsite", "offer"]),
  result: z.enum(["pending", "advanced", "rejected", "withdrawn", "accepted"]),
  reasonTags: z.array(z.string()).max(12).default([]),
  notes: z.string().max(2000).default(""),
  occurredAt: z.string(),
  includeInInsights: z.boolean().default(true),
  createdAt: z.string(),
});

export const learningActionSchema = z.object({
  id: z.string(),
  skill: z.string(),
  title: z.string(),
  rationale: z.string(),
  method: z.enum(["practice", "project", "course", "credential", "mentoring"]),
  durationWeeks: z.number().int().min(1).max(24),
  evidenceTarget: z.string(),
  status: z.enum(["planned", "in_progress", "completed", "skipped"]).default("planned"),
});

export const careerLearningPlanSchema = z.object({
  id: z.string(),
  targetRoleId: z.string(),
  title: z.string(),
  summary: z.string(),
  actions: z.array(learningActionSchema).max(12),
  evidenceIds: z.array(z.string()).default([]),
  model: z.string(),
  generatedAt: z.string(),
  updatedAt: z.string(),
});

export const careerCoachFeedbackSchema = z.object({
  question: z.string(),
  answer: z.string(),
  scores: z.object({
    clarity: z.number().int().min(0).max(100),
    evidence: z.number().int().min(0).max(100),
    relevance: z.number().int().min(0).max(100),
    structure: z.number().int().min(0).max(100),
  }),
  strengths: z.array(z.string()).max(6),
  improvements: z.array(z.string()).max(6),
  suggestedStructure: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  model: z.string(),
  generatedAt: z.string(),
});

export const careerMemoryItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["resume", "experience", "evidence", "application", "review", "outcome", "learning"]),
  title: z.string(),
  subtitle: z.string().default(""),
  content: z.string(),
  skills: z.array(z.string()).default([]),
  occurredAt: z.string().default(""),
  sourceId: z.string(),
});

export type CareerGoal = z.infer<typeof careerGoalSchema>;
export type CareerOutcome = z.infer<typeof careerOutcomeSchema>;
export type LearningAction = z.infer<typeof learningActionSchema>;
export type CareerLearningPlan = z.infer<typeof careerLearningPlanSchema>;
export type CareerCoachFeedback = z.infer<typeof careerCoachFeedbackSchema>;
export type CareerMemoryItem = z.infer<typeof careerMemoryItemSchema>;

export type RoleSkill = {
  name: string;
  category: "essential" | "technical" | "leadership" | "business";
  importance: number;
  aliases?: string[];
};

export type CareerRole = {
  id: string;
  title: string;
  family: string;
  level: "individual" | "senior" | "lead" | "executive";
  description: string;
  skills: RoleSkill[];
  adjacentRoleIds: string[];
};

export const careerRoleTaxonomyVersion = "resumora-2026.08-onet-aligned";
export const careerRoles: CareerRole[] = [
  {
    id: "senior-product-designer", title: "Senior Product Designer", family: "Design", level: "senior",
    description: "Shapes complex product experiences through research, interaction design, systems thinking, and cross-functional influence.",
    skills: [
      { name: "User research", category: "essential", importance: 10, aliases: ["customer research"] },
      { name: "Interaction design", category: "technical", importance: 10, aliases: ["UX design"] },
      { name: "Prototyping", category: "technical", importance: 8 },
      { name: "Design systems", category: "technical", importance: 9 },
      { name: "Product strategy", category: "business", importance: 8 },
      { name: "Stakeholder management", category: "leadership", importance: 8 },
      { name: "Analytics", category: "business", importance: 6, aliases: ["Amplitude", "data analysis"] },
      { name: "Mentoring", category: "leadership", importance: 6, aliases: ["coaching"] },
    ], adjacentRoleIds: ["lead-product-designer", "product-manager"],
  },
  {
    id: "lead-product-designer", title: "Lead Product Designer", family: "Design", level: "lead",
    description: "Sets product design direction, raises team quality, and aligns multiple product areas around customer and business outcomes.",
    skills: [
      { name: "Design leadership", category: "leadership", importance: 10, aliases: ["leadership", "team management"] },
      { name: "Product strategy", category: "business", importance: 10 },
      { name: "Design systems", category: "technical", importance: 8 },
      { name: "User research", category: "essential", importance: 8, aliases: ["customer research"] },
      { name: "Stakeholder management", category: "leadership", importance: 9 },
      { name: "Mentoring", category: "leadership", importance: 9, aliases: ["coaching"] },
      { name: "Roadmapping", category: "business", importance: 7 },
      { name: "Analytics", category: "business", importance: 6, aliases: ["data analysis", "Amplitude"] },
    ], adjacentRoleIds: ["senior-product-designer", "product-manager"],
  },
  {
    id: "product-manager", title: "Product Manager", family: "Product", level: "senior",
    description: "Discovers valuable problems, defines product direction, and coordinates delivery and measurement across functions.",
    skills: [
      { name: "Product strategy", category: "business", importance: 10 }, { name: "Roadmapping", category: "business", importance: 9 },
      { name: "Customer research", category: "essential", importance: 8, aliases: ["user research"] }, { name: "Analytics", category: "technical", importance: 8, aliases: ["data analysis", "Amplitude"] },
      { name: "Stakeholder management", category: "leadership", importance: 9 }, { name: "Prioritization", category: "business", importance: 9 },
      { name: "Experimentation", category: "technical", importance: 7, aliases: ["A/B testing"] }, { name: "Communication", category: "leadership", importance: 8 },
    ], adjacentRoleIds: ["senior-product-designer", "marketing-manager"],
  },
  {
    id: "software-engineer", title: "Senior Software Engineer", family: "Engineering", level: "senior",
    description: "Designs, delivers, and operates reliable software while improving engineering quality and team execution.",
    skills: [
      { name: "Software architecture", category: "technical", importance: 10 }, { name: "TypeScript", category: "technical", importance: 8, aliases: ["JavaScript"] },
      { name: "System design", category: "technical", importance: 10 }, { name: "Testing", category: "technical", importance: 8 },
      { name: "Cloud infrastructure", category: "technical", importance: 7, aliases: ["AWS", "Azure"] }, { name: "Databases", category: "technical", importance: 8, aliases: ["PostgreSQL", "SQL"] },
      { name: "Mentoring", category: "leadership", importance: 6 }, { name: "Communication", category: "essential", importance: 7 },
    ], adjacentRoleIds: ["platform-engineer", "engineering-manager"],
  },
  {
    id: "platform-engineer", title: "Platform Engineer", family: "Engineering", level: "senior",
    description: "Builds reliable internal platforms, delivery systems, and cloud foundations that improve developer effectiveness.",
    skills: [
      { name: "Kubernetes", category: "technical", importance: 10 }, { name: "Cloud infrastructure", category: "technical", importance: 10, aliases: ["AWS", "Azure"] },
      { name: "Docker", category: "technical", importance: 8 }, { name: "Observability", category: "technical", importance: 9 },
      { name: "Infrastructure as code", category: "technical", importance: 9 }, { name: "System design", category: "technical", importance: 8 },
      { name: "Reliability", category: "essential", importance: 9 }, { name: "Stakeholder management", category: "leadership", importance: 6 },
    ], adjacentRoleIds: ["software-engineer", "engineering-manager"],
  },
  {
    id: "engineering-manager", title: "Engineering Manager", family: "Engineering", level: "lead",
    description: "Builds healthy engineering teams, creates delivery clarity, and connects technical direction to business outcomes.",
    skills: [
      { name: "People management", category: "leadership", importance: 10, aliases: ["team management"] }, { name: "Technical strategy", category: "technical", importance: 9, aliases: ["software architecture"] },
      { name: "Mentoring", category: "leadership", importance: 9 }, { name: "Delivery management", category: "business", importance: 9, aliases: ["project management"] },
      { name: "Stakeholder management", category: "leadership", importance: 8 }, { name: "Hiring", category: "leadership", importance: 7 },
      { name: "Communication", category: "essential", importance: 9 }, { name: "System design", category: "technical", importance: 7 },
    ], adjacentRoleIds: ["software-engineer", "platform-engineer"],
  },
  {
    id: "data-scientist", title: "Data Scientist", family: "Data", level: "senior",
    description: "Uses statistical, analytical, and machine-learning methods to answer consequential product and business questions.",
    skills: [
      { name: "Python", category: "technical", importance: 10 }, { name: "SQL", category: "technical", importance: 9 },
      { name: "Statistics", category: "technical", importance: 10 }, { name: "Machine learning", category: "technical", importance: 9 },
      { name: "Experimentation", category: "technical", importance: 8, aliases: ["A/B testing"] }, { name: "Data visualization", category: "technical", importance: 7, aliases: ["Tableau"] },
      { name: "Business strategy", category: "business", importance: 7 }, { name: "Communication", category: "essential", importance: 8 },
    ], adjacentRoleIds: ["product-manager", "software-engineer"],
  },
  {
    id: "marketing-manager", title: "Marketing Manager", family: "Marketing", level: "lead",
    description: "Builds go-to-market strategy, develops customer insight, and measures programs that create sustainable demand.",
    skills: [
      { name: "Marketing strategy", category: "business", importance: 10 }, { name: "Market research", category: "essential", importance: 9 },
      { name: "Analytics", category: "technical", importance: 8, aliases: ["Google Analytics", "data analysis"] }, { name: "Positioning", category: "business", importance: 9 },
      { name: "Campaign management", category: "business", importance: 8 }, { name: "Communication", category: "essential", importance: 9 },
      { name: "Budget management", category: "business", importance: 7 }, { name: "Team management", category: "leadership", importance: 7 },
    ], adjacentRoleIds: ["product-manager"],
  },
];

export type CareerSkillSignal = RoleSkill & {
  strength: number;
  status: "proven" | "emerging" | "gap";
  evidenceIds: string[];
  explanation: string;
};

export type CareerPathStep = { roleId: string; title: string; readiness: number; gapSkills: string[]; kind: "target" | "adjacent" | "stretch" };
export type CareerOutcomeInsights = { tracked: number; advanced: number; rejected: number; offers: number; interviewConversion: number; topSignals: string[] };
export type CareerIntelligenceReport = {
  taxonomyVersion: string;
  targetRole: CareerRole;
  readiness: number;
  provenSkills: number;
  emergingSkills: number;
  gapSkills: number;
  skillSignals: CareerSkillSignal[];
  paths: CareerPathStep[];
  learningPlan: CareerLearningPlan;
  outcomeInsights: CareerOutcomeInsights;
  generatedAt: string;
};

const roleFor = (roleId: string) => careerRoles.find((role) => role.id === roleId) ?? careerRoles[0];
const contentHas = (content: string, terms: string[]) => terms.some((term) => normalize(content).includes(normalize(term)));

export function buildCareerIntelligence(
  resume: ResumeDocument,
  evidence: CareerEvidence[],
  applications: JobApplication[],
  outcomes: CareerOutcome[],
  targetRoleId: string,
): CareerIntelligenceReport {
  const targetRole = roleFor(targetRoleId);
  const resumeText = [resume.basics.headline, resume.summary, ...resume.skills.flatMap((group) => group.items), ...resume.experience.flatMap((item) => [item.role, item.company, ...item.bullets])].join(" ");
  const verifiedEvidence = evidence.filter((item) => item.verified);
  const skillSignals = targetRole.skills.map((skill): CareerSkillSignal => {
    const terms = [skill.name, ...(skill.aliases ?? [])];
    const linked = verifiedEvidence.filter((item) => contentHas(`${item.title} ${item.description} ${item.skills.join(" ")}`, terms));
    const inResume = contentHas(resumeText, terms);
    const metricCount = linked.filter((item) => item.metrics.length).length;
    const strength = Math.min(100, linked.length * 34 + metricCount * 16 + (inResume ? 24 : 0));
    const status = strength >= 68 ? "proven" : strength >= 28 ? "emerging" : "gap";
    return {
      ...skill,
      strength,
      status,
      evidenceIds: linked.map((item) => item.id),
      explanation: status === "proven"
        ? `${linked.length} verified record${linked.length === 1 ? "" : "s"}${metricCount ? `, including ${metricCount} with measurable scope` : ""}.`
        : status === "emerging"
          ? "Some resume or Career Vault evidence exists, but another concrete outcome would make this more defensible."
          : "No defensible evidence was found. Build proof before adding this skill to applications.",
    };
  }).sort((a, b) => b.importance - a.importance || a.strength - b.strength);
  const weightTotal = skillSignals.reduce((sum, skill) => sum + skill.importance, 0);
  const readiness = weightTotal ? Math.round(skillSignals.reduce((sum, skill) => sum + skill.strength * skill.importance, 0) / weightTotal) : 0;
  const gapSkills = skillSignals.filter((skill) => skill.status !== "proven").slice(0, 5);
  const now = new Date().toISOString();
  const learningPlan: CareerLearningPlan = {
    id: `plan-${targetRole.id}`,
    targetRoleId: targetRole.id,
    title: `${targetRole.title} evidence plan`,
    summary: gapSkills.length ? `Build defensible proof in ${gapSkills.map((skill) => skill.name).join(", ")}.` : "Strengthen depth and recency in already-proven capabilities.",
    actions: gapSkills.map((skill, index) => ({
      id: `learn-${targetRole.id}-${normalize(skill.name).replace(/\s+/g, "-")}`,
      skill: skill.name,
      title: skill.status === "gap" ? `Create a scoped ${skill.name} proof project` : `Deepen ${skill.name} with a measurable outcome`,
      rationale: `${skill.name} carries ${skill.importance}/10 importance for ${targetRole.title} and currently has ${skill.strength}/100 evidence strength.`,
      method: index === 0 ? "project" : index === 1 ? "mentoring" : "practice",
      durationWeeks: Math.min(8, 3 + index),
      evidenceTarget: `One verified Career Vault record describing the problem, your decisions, scope, and a truthful outcome for ${skill.name}.`,
      status: "planned",
    })),
    evidenceIds: unique(skillSignals.flatMap((skill) => skill.evidenceIds)),
    model: "deterministic",
    generatedAt: now,
    updatedAt: now,
  };
  const includedOutcomes = outcomes.filter((outcome) => outcome.includeInInsights);
  const advanced = includedOutcomes.filter((outcome) => ["advanced", "accepted"].includes(outcome.result)).length;
  const rejected = includedOutcomes.filter((outcome) => outcome.result === "rejected").length;
  const offers = includedOutcomes.filter((outcome) => outcome.stage === "offer").length + applications.filter((application) => application.status === "offer").length;
  const interviewApplications = applications.filter((application) => ["interview", "offer"].includes(application.status)).length;
  const appliedApplications = applications.filter((application) => !["saved", "preparing", "withdrawn"].includes(application.status)).length;
  const tagCounts = includedOutcomes.flatMap((outcome) => outcome.reasonTags).reduce<Record<string, number>>((counts, tag) => ({ ...counts, [tag]: (counts[tag] ?? 0) + 1 }), {});
  const topSignals = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag]) => tag);
  const paths = [targetRole, ...targetRole.adjacentRoleIds.map(roleFor)].filter((role, index, roles) => roles.findIndex((item) => item.id === role.id) === index).map((role, index): CareerPathStep => {
    const missing = role.skills.filter((skill) => !contentHas(resumeText + " " + verifiedEvidence.map((item) => `${item.description} ${item.skills.join(" ")}`).join(" "), [skill.name, ...(skill.aliases ?? [])]));
    return { roleId: role.id, title: role.title, readiness: index === 0 ? readiness : Math.max(20, Math.round(100 - missing.reduce((sum, skill) => sum + skill.importance, 0) * 1.5)), gapSkills: missing.slice(0, 4).map((skill) => skill.name), kind: index === 0 ? "target" : index === 1 ? "adjacent" : "stretch" };
  });
  return {
    taxonomyVersion: careerRoleTaxonomyVersion,
    targetRole,
    readiness,
    provenSkills: skillSignals.filter((skill) => skill.status === "proven").length,
    emergingSkills: skillSignals.filter((skill) => skill.status === "emerging").length,
    gapSkills: skillSignals.filter((skill) => skill.status === "gap").length,
    skillSignals,
    paths,
    learningPlan,
    outcomeInsights: { tracked: includedOutcomes.length, advanced, rejected, offers, interviewConversion: appliedApplications ? Math.round(interviewApplications / appliedApplications * 100) : 0, topSignals },
    generatedAt: now,
  };
}

export function buildCareerMemory(resume: ResumeDocument, evidence: CareerEvidence[], applications: JobApplication[], outcomes: CareerOutcome[]): CareerMemoryItem[] {
  return [
    ...resume.experience.map((item): CareerMemoryItem => ({ id: `memory-exp-${item.id}`, kind: "experience", title: item.role, subtitle: item.company, content: item.bullets.join(" "), skills: [], occurredAt: item.endDate || item.startDate, sourceId: item.id })),
    ...evidence.map((item): CareerMemoryItem => ({ id: `memory-evidence-${item.id}`, kind: "evidence", title: item.title, subtitle: item.organization, content: `${item.description} ${item.metrics.join(" ")}`, skills: item.skills, occurredAt: item.date, sourceId: item.id })),
    ...applications.map((item): CareerMemoryItem => ({ id: `memory-app-${item.id}`, kind: "application", title: item.role, subtitle: item.company, content: `${item.notes} ${item.nextAction}`, skills: item.job ? [...item.job.requiredSkills, ...item.job.preferredSkills] : [], occurredAt: item.updatedAt, sourceId: item.id })),
    ...outcomes.map((item): CareerMemoryItem => ({ id: `memory-outcome-${item.id}`, kind: "outcome", title: `${item.stage.replaceAll("_", " ")} · ${item.result}`, subtitle: item.reasonTags.join(" · "), content: item.notes, skills: [], occurredAt: item.occurredAt, sourceId: item.id })),
  ];
}

export function searchCareerMemory(items: CareerMemoryItem[], query: string): CareerMemoryItem[] {
  const tokens = normalize(query).split(" ").filter((token) => token.length > 1);
  return items.map((item) => {
    const haystack = normalize(`${item.title} ${item.subtitle} ${item.content} ${item.skills.join(" ")}`);
    const score = tokens.length ? tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0) : 1;
    return { item, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || b.item.occurredAt.localeCompare(a.item.occurredAt)).slice(0, 30).map(({ item }) => item);
}

export function buildInterviewCoachFeedback(question: string, answer: string, evidence: CareerEvidence[], targetRoleId: string): CareerCoachFeedback {
  const verified = evidence.filter((item) => item.verified);
  const matched = verified.filter((item) => contentHas(answer, [item.title, ...item.skills, ...item.metrics]));
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const hasMetric = /\b\d+(?:[.,]\d+)?(?:%|\+|x|k|m|b)?\b/i.test(answer);
  const hasSequence = /\b(first|then|after|finally|result|outcome|because|so that)\b/i.test(answer);
  const role = roleFor(targetRoleId);
  const relevanceTerms = role.skills.filter((skill) => contentHas(answer, [skill.name, ...(skill.aliases ?? [])]));
  return {
    question,
    answer,
    scores: {
      clarity: Math.min(100, wordCount >= 70 && wordCount <= 220 ? 88 : wordCount >= 35 ? 68 : 42),
      evidence: Math.min(100, matched.length * 28 + (hasMetric ? 28 : 8)),
      relevance: Math.min(100, 35 + relevanceTerms.length * 16),
      structure: hasSequence ? 84 : wordCount >= 60 ? 64 : 45,
    },
    strengths: [matched.length ? `Connects to ${matched.length} verified Career Vault record${matched.length === 1 ? "" : "s"}.` : "Keeps the answer within the facts supplied for review.", hasMetric ? "Uses concrete scope or outcome evidence." : "The answer can be strengthened without inventing metrics."],
    improvements: [wordCount < 70 ? "Add enough context to make your responsibility and decisions clear." : "Remove details that do not change the decision or outcome.", !hasMetric ? "Add truthful scale, quality, time, or business impact where available." : "Connect the metric explicitly to your actions.", !hasSequence ? "Use a clear situation → responsibility → actions → result sequence." : "End with what you learned or would repeat."],
    suggestedStructure: "Situation and constraint → your exact responsibility → two or three decisions → measurable or observable result → lesson relevant to the target role.",
    evidenceIds: matched.map((item) => item.id),
    model: "deterministic",
    generatedAt: new Date().toISOString(),
  };
}

export const portfolioThemeSchema = z.enum(["editorial", "minimal", "contrast"]);
export const portfolioStatusSchema = z.enum(["draft", "published", "revoked"]);

export const portfolioPublicationSchema = z.object({
  id: z.string().min(1).max(140),
  slug: z.string().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().min(1).max(120),
  headline: z.string().min(1).max(180),
  bio: z.string().max(1200),
  location: z.string().max(160).default(""),
  evidenceIds: z.array(z.string()).max(16),
  featuredSkills: z.array(z.string().max(80)).max(18).default([]),
  linkUrls: z.array(z.string().url()).max(12).default([]),
  theme: portfolioThemeSchema.default("editorial"),
  showEmail: z.boolean().default(false),
  contactEmail: z.string().email().or(z.literal("")).default(""),
  status: portfolioStatusSchema.default("draft"),
  consentVersion: z.string().min(1).max(40).default("portfolio-v1"),
  publishedAt: z.string().optional(),
  updatedAt: z.string(),
});

export const portfolioProjectSchema = z.object({
  id: z.string(),
  type: careerEvidenceSchema.shape.type,
  title: z.string(),
  organization: z.string(),
  description: z.string(),
  skills: z.array(z.string()),
  metrics: z.array(z.string()),
  date: z.string(),
});

export const publicPortfolioSchema = portfolioPublicationSchema.pick({
  slug: true,
  displayName: true,
  headline: true,
  bio: true,
  location: true,
  featuredSkills: true,
  theme: true,
  publishedAt: true,
}).extend({
  contactEmail: z.string().email().or(z.literal("")),
  links: z.array(linkSchema).max(12),
  projects: z.array(portfolioProjectSchema).max(16),
});

export type PortfolioPublication = z.infer<typeof portfolioPublicationSchema>;
export type PublicPortfolio = z.infer<typeof publicPortfolioSchema>;

export function buildPublicPortfolio(publication: PortfolioPublication, resume: ResumeDocument, evidence: CareerEvidence[]): PublicPortfolio {
  const selectedIds = new Set(publication.evidenceIds);
  const projects = evidence.filter((item) => item.verified && selectedIds.has(item.id)).map((item) => portfolioProjectSchema.parse({
    id: item.id,
    type: item.type,
    title: item.title,
    organization: item.organization,
    description: item.description,
    skills: item.skills,
    metrics: item.metrics,
    date: item.date,
  }));
  return publicPortfolioSchema.parse({
    slug: publication.slug,
    displayName: publication.displayName,
    headline: publication.headline,
    bio: publication.bio,
    location: publication.location,
    featuredSkills: publication.featuredSkills,
    theme: publication.theme,
    publishedAt: publication.publishedAt,
    contactEmail: publication.showEmail ? publication.contactEmail : "",
    links: resume.basics.links.filter((link) => publication.linkUrls.includes(link.url) && /^https?:\/\//i.test(link.url)),
    projects,
  });
}

export const organizationTypeSchema = z.enum(["coaching", "university", "outplacement", "employer"]);
export const organizationRoleSchema = z.enum(["owner", "admin", "coach", "participant"]);
export const organizationDataScopeSchema = z.enum(["resume_summary", "career_evidence", "application_progress", "learning_plan"]);

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(140),
  slug: z.string().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: organizationTypeSchema,
  createdAt: z.string(),
});

export const organizationMembershipSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  displayName: z.string().max(120).default(""),
  email: z.string().email().or(z.literal("")),
  role: organizationRoleSchema,
  joinedAt: z.string(),
});

export const organizationDataGrantSchema = z.object({
  organizationId: z.string(),
  participantUserId: z.string(),
  scopes: z.array(organizationDataScopeSchema).max(4),
  consentedAt: z.string(),
  revokedAt: z.string().optional(),
});

export const organizationParticipantProfileSchema = z.object({
  organizationId: z.string(),
  participantUserId: z.string(),
  displayName: z.string().max(120),
  targetTitle: z.string().max(180),
  readiness: z.number().min(0).max(100),
  evidenceCount: z.number().int().min(0),
  applicationsActive: z.number().int().min(0),
  learningCompleted: z.number().int().min(0),
  learningTotal: z.number().int().min(0),
  updatedAt: z.string(),
});

export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationMembership = z.infer<typeof organizationMembershipSchema>;
export type OrganizationDataGrant = z.infer<typeof organizationDataGrantSchema>;
export type OrganizationParticipantProfile = z.infer<typeof organizationParticipantProfileSchema>;

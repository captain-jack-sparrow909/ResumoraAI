"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BarChart3, BrainCircuit, BriefcaseBusiness, Check,
  ChevronRight, CircleAlert, Compass, Database, FileSearch, Gauge,
  GraduationCap, LayoutDashboard, LibraryBig, LoaderCircle, LockKeyhole, Plus, Globe2,
  Search, ShieldCheck, Sparkles, Target, TrendingUp, UserRoundSearch, UsersRound, X,
} from "lucide-react";
import {
  buildCareerIntelligence,
  buildCareerMemory,
  careerRoles,
  demoApplications,
  demoCareerEvidence,
  demoResume,
  searchCareerMemory,
  type CareerCoachFeedback,
  type CareerEvidence,
  type CareerGoal,
  type CareerLearningPlan,
  type CareerMemoryItem,
  type CareerOutcome,
  type JobApplication,
  type ResumeDocument,
} from "@resumora/domain";
import { Logo } from "@/components/logo";
import {
  coachInterviewAnswer,
  loadCareerState,
  refineCareerPlan,
  saveCareerCoachingSession,
  saveCareerGoal,
  saveCareerLearningPlan,
  saveCareerOutcome,
  searchCareerMemoryRemotely,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type IntelligenceTab = "overview" | "skills" | "paths" | "learning" | "memory" | "outcomes" | "coach";

const demoOutcomes: CareerOutcome[] = [
  { id: "outcome-demo-screen", applicationId: "application-meridian", stage: "recruiter_screen", result: "advanced", reasonTags: ["strong portfolio", "platform experience"], notes: "Recruiter responded well to the platform case study and cross-functional scope.", occurredAt: "2026-07-24T10:00:00.000Z", includeInInsights: true, createdAt: "2026-07-24T10:00:00.000Z" },
  { id: "outcome-demo-manager", applicationId: "application-meridian", stage: "hiring_manager", result: "advanced", reasonTags: ["systems thinking", "mentoring"], notes: "Hiring manager asked for deeper examples of mentoring and design direction.", occurredAt: "2026-07-31T13:00:00.000Z", includeInInsights: true, createdAt: "2026-07-31T13:00:00.000Z" },
];

const initialGoal: CareerGoal = { targetRoleId: "lead-product-designer", targetTitle: "Lead Product Designer", horizonMonths: 12, weeklyHours: 5, priorities: ["Leadership evidence", "Portfolio depth"], updatedAt: new Date().toISOString() };

const tabItems: Array<{ id: IntelligenceTab; label: string; icon: typeof Compass }> = [
  { id: "overview", label: "Overview", icon: Compass }, { id: "skills", label: "Skill map", icon: Gauge },
  { id: "paths", label: "Paths", icon: TrendingUp }, { id: "learning", label: "Learning", icon: GraduationCap },
  { id: "memory", label: "Career memory", icon: Database }, { id: "outcomes", label: "Outcomes", icon: BarChart3 },
  { id: "coach", label: "Interview coach", icon: UserRoundSearch },
];

export function CareerIntelligenceWorkspace() {
  const [tab, setTab] = useState<IntelligenceTab>("overview");
  const [resume, setResume] = useState<ResumeDocument>(demoResume);
  const [evidence, setEvidence] = useState<CareerEvidence[]>(demoCareerEvidence);
  const [applications, setApplications] = useState<JobApplication[]>(demoApplications);
  const [goal, setGoal] = useState<CareerGoal>(initialGoal);
  const [outcomes, setOutcomes] = useState<CareerOutcome[]>(demoOutcomes);
  const [plans, setPlans] = useState<Record<string, CareerLearningPlan>>({});
  const [coachingHistory, setCoachingHistory] = useState<CareerCoachFeedback[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<"local" | "syncing" | "synced">("local");
  const [notice, setNotice] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const read = <T,>(key: string, fallback: T): T => { const value = localStorage.getItem(key); if (!value) return fallback; try { return JSON.parse(value) as T; } catch { return fallback; } };
      setResume(read("resumora:resume", demoResume));
      setEvidence(read("resumora:career-vault", demoCareerEvidence));
      setApplications(read("resumora:applications", demoApplications));
      setGoal(read("resumora:career-goal", initialGoal));
      setOutcomes(read("resumora:career-outcomes", demoOutcomes));
      setPlans(read("resumora:career-plans", {}));
      setCoachingHistory(read("resumora:career-coaching", []));
      const supabase = getSupabaseBrowserClient();
      if (supabase) void supabase.auth.getSession().then(async ({ data }) => {
        const token = data.session?.access_token;
        if (!token) return;
        setAuthToken(token);
        try {
          const cloud = await loadCareerState(token);
          if (cloud.goal) setGoal(cloud.goal);
          if (cloud.outcomes.length) setOutcomes(cloud.outcomes);
          if (cloud.plans.length) setPlans(Object.fromEntries(cloud.plans.map((plan) => [plan.targetRoleId, plan])));
          if (cloud.coaching.length) setCoachingHistory(cloud.coaching);
          setCloudStatus("synced");
        } catch { setCloudStatus("local"); }
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const report = useMemo(() => buildCareerIntelligence(resume, evidence, applications, outcomes, goal.targetRoleId), [resume, evidence, applications, outcomes, goal.targetRoleId]);
  const activePlan = plans[goal.targetRoleId] ?? report.learningPlan;

  const updateGoal = (patch: Partial<CareerGoal>) => {
    const role = patch.targetRoleId ? careerRoles.find((item) => item.id === patch.targetRoleId) : null;
    const next = { ...goal, ...patch, ...(role ? { targetTitle: role.title } : {}), updatedAt: new Date().toISOString() };
    setGoal(next); localStorage.setItem("resumora:career-goal", JSON.stringify(next));
    if (authToken) { setCloudStatus("syncing"); void saveCareerGoal(next, authToken).then(() => setCloudStatus("synced")).catch(() => setCloudStatus("local")); }
  };

  const generatePlan = async () => {
    setPlanLoading(true);
    try {
      const result = await refineCareerPlan(goal, report.learningPlan, evidence.filter((item) => item.verified));
      const next = { ...plans, [goal.targetRoleId]: result };
      setPlans(next); localStorage.setItem("resumora:career-plans", JSON.stringify(next));
      if (authToken) void saveCareerLearningPlan(result, authToken).catch(() => undefined);
      setNotice(result.warning ?? `Learning plan refined with ${result.model}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The deterministic plan remains available."); }
    finally { setPlanLoading(false); }
  };

  const updatePlanAction = (actionId: string, status: CareerLearningPlan["actions"][number]["status"]) => {
    const plan = { ...activePlan, actions: activePlan.actions.map((action) => action.id === actionId ? { ...action, status } : action), updatedAt: new Date().toISOString() };
    const next = { ...plans, [goal.targetRoleId]: plan }; setPlans(next); localStorage.setItem("resumora:career-plans", JSON.stringify(next));
    if (authToken) void saveCareerLearningPlan(plan, authToken).catch(() => undefined);
  };

  const addOutcome = (outcome: CareerOutcome) => {
    const next = [outcome, ...outcomes]; setOutcomes(next); localStorage.setItem("resumora:career-outcomes", JSON.stringify(next)); setOutcomeOpen(false);
    if (authToken) void saveCareerOutcome(outcome, authToken).catch(() => undefined);
  };

  const saveCoaching = (feedback: CareerCoachFeedback) => {
    const next = [feedback, ...coachingHistory].slice(0, 20); setCoachingHistory(next); localStorage.setItem("resumora:career-coaching", JSON.stringify(next));
    if (authToken) void saveCareerCoachingSession(`coach-${crypto.randomUUID()}`, goal.targetRoleId, feedback, authToken).catch(() => undefined);
  };

  return <main className="intelligence-shell">
    <header className="intelligence-topbar"><Logo /><nav><Link href="/applications"><LayoutDashboard size={14} /> Applications</Link><Link href="/workspace"><Target size={14} /> Job workspace</Link><Link href="/builder"><BriefcaseBusiness size={14} /> Resume</Link><Link href="/portfolio"><Globe2 size={14} /> Portfolio</Link><Link href="/organizations"><UsersRound size={14} /> Organizations</Link></nav><span><LockKeyhole size={12} /> {cloudStatus === "syncing" ? "Syncing" : cloudStatus === "synced" ? "Private · synced" : "Private · local"}</span></header>
    <section className="intelligence-hero"><div><span className="phase-pill">Phase 4 · Career intelligence</span><h1>Turn your career history into a <em>direction you can defend.</em></h1><p>Resumora maps verified evidence to role capabilities, shows what is proven versus missing, and turns gaps into practical evidence-building work.</p></div><div className="goal-card"><label><span>Target direction</span><select value={goal.targetRoleId} onChange={(event) => updateGoal({ targetRoleId: event.target.value })}>{careerRoles.map((role) => <option value={role.id} key={role.id}>{role.title}</option>)}</select></label><div><label><span>Horizon</span><select value={goal.horizonMonths} onChange={(event) => updateGoal({ horizonMonths: Number(event.target.value) })}><option value={6}>6 months</option><option value={12}>12 months</option><option value={18}>18 months</option><option value={24}>24 months</option></select></label><label><span>Weekly focus</span><select value={goal.weeklyHours} onChange={(event) => updateGoal({ weeklyHours: Number(event.target.value) })}><option value={3}>3 hours</option><option value={5}>5 hours</option><option value={8}>8 hours</option><option value={12}>12 hours</option></select></label></div></div></section>
    <div className="intelligence-layout"><aside className="intelligence-nav"><div className="readiness-dial" style={{ "--readiness": `${report.readiness * 3.6}deg` } as React.CSSProperties}><strong>{report.readiness}</strong><small>evidence readiness</small></div><nav aria-label="Career intelligence sections">{tabItems.map(({ id, label, icon: Icon }) => <button aria-label={label} aria-pressed={tab === id} className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)}><Icon size={15} /><span>{label}</span>{id === "skills" && <b>{report.gapSkills}</b>}</button>)}</nav><div className="taxonomy-note"><ShieldCheck size={15} /><p><strong>Explainable by design</strong>Mapped from your data using taxonomy {report.taxonomyVersion}.</p></div></aside><section className="intelligence-content">{tab === "overview" && <Overview report={report} applications={applications} onNavigate={setTab} />}
      {tab === "skills" && <SkillMap report={report} />}
      {tab === "paths" && <CareerPaths report={report} />}
      {tab === "learning" && <LearningPlan plan={activePlan} weeklyHours={goal.weeklyHours} loading={planLoading} onGenerate={generatePlan} onStatus={updatePlanAction} />}
      {tab === "memory" && <CareerMemory resume={resume} evidence={evidence} applications={applications} outcomes={outcomes} authToken={authToken} />}
      {tab === "outcomes" && <Outcomes outcomes={outcomes} applications={applications} report={report} onAdd={() => setOutcomeOpen(true)} />}
      {tab === "coach" && <InterviewCoach targetRoleId={goal.targetRoleId} targetTitle={report.targetRole.title} evidence={evidence} gaps={report.skillSignals.filter((skill) => skill.status !== "proven").map((skill) => skill.name)} history={coachingHistory} onSave={saveCoaching} onNotice={setNotice} />}
    </section></div>
    {outcomeOpen && <OutcomeModal applications={applications} onClose={() => setOutcomeOpen(false)} onSave={addOutcome} />}
    {notice && <div className="workspace-toast"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button></div>}
  </main>;
}

function Overview({ report, applications, onNavigate }: { report: ReturnType<typeof buildCareerIntelligence>; applications: JobApplication[]; onNavigate: (tab: IntelligenceTab) => void }) {
  const topGaps = report.skillSignals.filter((skill) => skill.status !== "proven").slice(0, 3);
  return <><div className="intelligence-heading"><span>Career signal</span><h2>{report.targetRole.title}</h2><p>{report.targetRole.description}</p></div><div className="intelligence-metrics"><Metric icon={Check} value={report.provenSkills} label="Proven skills" /><Metric icon={Sparkles} value={report.emergingSkills} label="Emerging" /><Metric icon={CircleAlert} value={report.gapSkills} label="Evidence gaps" /><Metric icon={BriefcaseBusiness} value={applications.length} label="Applications tracked" /></div><div className="overview-grid"><article className="priority-card"><header><div><span>Priority gaps</span><h3>Build proof where it matters.</h3></div><button onClick={() => onNavigate("skills")}>Full skill map <ArrowRight size={13} /></button></header>{topGaps.map((skill, index) => <div className="priority-skill" key={skill.name}><i>{String(index + 1).padStart(2, "0")}</i><div><strong>{skill.name}</strong><p>{skill.explanation}</p></div><b>{skill.importance}/10</b></div>)}</article><article className="momentum-card"><span>Application feedback loop</span><strong>{report.outcomeInsights.interviewConversion}%</strong><small>application-to-interview signal</small><p>{report.outcomeInsights.tracked ? `${report.outcomeInsights.tracked} explicit outcomes are included in your private insights.` : "Log outcomes to learn which positioning and evidence create progress."}</p><button onClick={() => onNavigate("outcomes")}>Review outcomes <ChevronRight size={13} /></button></article></div><div className="next-plan"><BrainCircuit size={22} /><div><span>Recommended next move</span><strong>{report.learningPlan.actions[0]?.title ?? "Keep your evidence current"}</strong><p>{report.learningPlan.actions[0]?.rationale ?? "Add a verified outcome after your next substantial project."}</p></div><button onClick={() => onNavigate("learning")}>Open learning plan <ArrowRight size={13} /></button></div></>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof Check; value: string | number; label: string }) { return <div><Icon size={15} /><span><strong>{value}</strong><small>{label}</small></span></div>; }

function SkillMap({ report }: { report: ReturnType<typeof buildCareerIntelligence> }) {
  return <><div className="intelligence-heading"><span>Role capability map</span><h2>Proof, depth, and gaps.</h2><p>Evidence strength reflects only resume content and verified Career Vault records. Importance comes from the selected Resumora role profile.</p></div><div className="skill-map-legend"><span><i className="proven" /> Proven</span><span><i className="emerging" /> Emerging</span><span><i className="gap" /> Gap</span></div><div className="career-skill-list">{report.skillSignals.map((skill) => <article key={skill.name}><div className={`skill-status ${skill.status}`}><span>{skill.strength}</span></div><div><header><strong>{skill.name}</strong><b>{skill.category} · importance {skill.importance}/10</b></header><p>{skill.explanation}</p>{skill.evidenceIds.length > 0 && <small><LibraryBig size={11} /> {skill.evidenceIds.length} verified source{skill.evidenceIds.length === 1 ? "" : "s"}</small>}</div><i className="skill-strength"><em style={{ width: `${skill.strength}%` }} /></i></article>)}</div></>;
}

function CareerPaths({ report }: { report: ReturnType<typeof buildCareerIntelligence> }) {
  return <><div className="intelligence-heading"><span>Career path explorer</span><h2>One target, adjacent options.</h2><p>Paths compare your existing evidence with related role profiles. They are preparation signals—not predictions of promotion or hiring.</p></div><div className="path-grid">{report.paths.map((path, index) => <article key={path.roleId} className={path.kind}><div className="path-number">0{index + 1}</div><span>{path.kind}</span><h3>{path.title}</h3><div className="path-readiness"><strong>{path.readiness}%</strong><i><em style={{ width: `${path.readiness}%` }} /></i></div><small>Key evidence to build</small>{path.gapSkills.length ? path.gapSkills.map((skill) => <p key={skill}><CircleAlert size={11} />{skill}</p>) : <p><Check size={11} />No major vocabulary gaps detected</p>}</article>)}</div></>;
}

function LearningPlan({ plan, weeklyHours, loading, onGenerate, onStatus }: { plan: CareerLearningPlan; weeklyHours: number; loading: boolean; onGenerate: () => void; onStatus: (id: string, status: CareerLearningPlan["actions"][number]["status"]) => void }) {
  const completed = plan.actions.filter((action) => action.status === "completed").length;
  return <><div className="intelligence-heading learning-heading"><div><span>Evidence-building plan</span><h2>{plan.title}</h2><p>{plan.summary}</p></div><button onClick={onGenerate} disabled={loading}>{loading ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />} Refine with DeepSeek</button></div><div className="plan-progress"><div><strong>{completed}/{plan.actions.length}</strong><span>actions completed · {weeklyHours} hours/week</span></div><i><em style={{ width: `${plan.actions.length ? completed / plan.actions.length * 100 : 0}%` }} /></i><small>Generated by {plan.model} · every action should create evidence you can defend</small></div><div className="learning-list">{plan.actions.length ? plan.actions.map((action, index) => <article key={action.id} className={action.status}><div className="learning-index">{String(index + 1).padStart(2, "0")}</div><div><span>{action.method} · {action.durationWeeks} weeks</span><h3>{action.title}</h3><p>{action.rationale}</p><div className="evidence-target"><ShieldCheck size={12} /><span><strong>Proof target</strong>{action.evidenceTarget}</span></div></div><select aria-label={`Status for ${action.title}`} value={action.status} onChange={(event) => onStatus(action.id, event.target.value as typeof action.status)}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="skipped">Skipped</option></select></article>) : <div className="intelligence-empty"><Check size={24} /><h3>No material evidence gaps detected.</h3><p>Keep Career Vault records current as your work changes.</p></div>}</div></>;
}

function CareerMemory({ resume, evidence, applications, outcomes, authToken }: { resume: ResumeDocument; evidence: CareerEvidence[]; applications: JobApplication[]; outcomes: CareerOutcome[]; authToken: string | null }) {
  const [query, setQuery] = useState(""); const [remoteItems, setRemoteItems] = useState<CareerMemoryItem[] | null>(null); const [loading, setLoading] = useState(false);
  const localItems = useMemo(() => buildCareerMemory(resume, evidence, applications, outcomes), [resume, evidence, applications, outcomes]);
  const items = remoteItems ?? searchCareerMemory(localItems, query);
  const search = async () => { if (!authToken) { setRemoteItems(null); return; } setLoading(true); try { const result = await searchCareerMemoryRemotely(query, authToken); setRemoteItems(result.items); } finally { setLoading(false); } };
  return <><div className="intelligence-heading"><span>Career memory</span><h2>Find the proof you forgot.</h2><p>Search experience, evidence, applications, outcomes, saved plans, and reviewer feedback. Signed-in search stays scoped to your own records.</p></div><div className="memory-search"><Search size={16} /><input aria-label="Search career memory" value={query} onChange={(event) => { setQuery(event.target.value); setRemoteItems(null); }} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Try ‘design systems’, ‘mentoring’, or ‘conversion’" /><button onClick={search}>{loading ? <LoaderCircle className="spin" size={14} /> : <FileSearch size={14} />} Search</button></div><div className="memory-summary"><Database size={15} /> {items.length} matching records <span>{authToken ? "Private cloud + local history" : "Local history"}</span></div><div className="memory-results">{items.map((item) => <article key={item.id}><i className={item.kind}><MemoryIcon kind={item.kind} /></i><div><span>{item.kind}{item.occurredAt ? ` · ${formatMemoryDate(item.occurredAt)}` : ""}</span><h3>{item.title}</h3>{item.subtitle && <strong>{item.subtitle}</strong>}<p>{item.content}</p>{item.skills.length > 0 && <footer>{item.skills.slice(0, 6).map((skill) => <b key={skill}>{skill}</b>)}</footer>}</div></article>)}</div></>;
}

function MemoryIcon({ kind }: { kind: CareerMemoryItem["kind"] }) { return kind === "evidence" ? <ShieldCheck size={14} /> : kind === "application" ? <BriefcaseBusiness size={14} /> : kind === "outcome" ? <BarChart3 size={14} /> : kind === "learning" ? <GraduationCap size={14} /> : <FileSearch size={14} />; }

function Outcomes({ outcomes, applications, report, onAdd }: { outcomes: CareerOutcome[]; applications: JobApplication[]; report: ReturnType<typeof buildCareerIntelligence>; onAdd: () => void }) {
  return <><div className="intelligence-heading outcomes-heading"><div><span>Private outcome calibration</span><h2>Learn from the process.</h2><p>Record what happened and your interpretation. Notes stay private and are excluded from insights whenever you choose.</p></div><button onClick={onAdd}><Plus size={14} /> Log outcome</button></div><div className="outcome-metrics"><Metric icon={Database} value={report.outcomeInsights.tracked} label="Included outcomes" /><Metric icon={TrendingUp} value={report.outcomeInsights.advanced} label="Advanced" /><Metric icon={UserRoundSearch} value={`${report.outcomeInsights.interviewConversion}%`} label="Interview signal" /><Metric icon={BriefcaseBusiness} value={applications.filter((item) => item.status === "offer").length} label="Offers" /></div>{report.outcomeInsights.topSignals.length > 0 && <div className="signal-strip"><span>Repeated signals</span>{report.outcomeInsights.topSignals.map((signal) => <b key={signal}>{signal}</b>)}</div>}<div className="outcome-list">{outcomes.map((outcome) => { const application = applications.find((item) => item.id === outcome.applicationId); return <article key={outcome.id}><div className={`outcome-result ${outcome.result}`}>{outcome.result === "advanced" || outcome.result === "accepted" ? <Check size={14} /> : <CircleAlert size={14} />}</div><div><span>{outcome.stage.replaceAll("_", " ")} · {new Date(outcome.occurredAt).toLocaleDateString()}</span><h3>{application ? `${application.role} · ${application.company}` : outcome.result}</h3><p>{outcome.notes || "No private note added."}</p><footer>{outcome.reasonTags.map((tag) => <b key={tag}>{tag}</b>)}</footer></div><small>{outcome.includeInInsights ? <><Gauge size={11} /> Included</> : <><LockKeyhole size={11} /> Excluded</>}</small></article>; })}</div></>;
}

function InterviewCoach({ targetRoleId, targetTitle, evidence, gaps, history, onSave, onNotice }: { targetRoleId: string; targetTitle: string; evidence: CareerEvidence[]; gaps: string[]; history: CareerCoachFeedback[]; onSave: (feedback: CareerCoachFeedback) => void; onNotice: (message: string) => void }) {
  const defaultQuestion = `Tell me about a time you demonstrated ${gaps[0] ?? "leadership"} in a difficult situation.`;
  const [question, setQuestion] = useState(defaultQuestion); const [answer, setAnswer] = useState(""); const [feedback, setFeedback] = useState<CareerCoachFeedback | null>(history[0] ?? null); const [loading, setLoading] = useState(false);
  const coach = async () => { setLoading(true); try { const result = await coachInterviewAnswer(question, answer, targetRoleId, targetTitle, evidence.filter((item) => item.verified)); setFeedback(result); onSave(result); onNotice(result.warning ?? `Answer coached with ${result.model}.`); } catch (error) { onNotice(error instanceof Error ? error.message : "Coaching is temporarily unavailable."); } finally { setLoading(false); } };
  return <><div className="intelligence-heading"><span>Evidence-grounded interview coach</span><h2>Practice the answer, not a script.</h2><p>DeepSeek critiques what you wrote against the target role and verified Career Vault evidence. It will not invent an ideal story for you.</p></div><div className="coach-grid"><div className="coach-form"><label><span>Practice question</span><textarea rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} /></label><label><span>Your answer <small>{answer.trim().split(/\s+/).filter(Boolean).length} words</small></span><textarea rows={14} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Describe the situation, your exact responsibility, decisions, result, and what you learned…" /></label><button onClick={coach} disabled={loading || answer.trim().length < 20}>{loading ? <LoaderCircle className="spin" size={15} /> : <BrainCircuit size={15} />} Coach this answer</button></div><div className="coach-feedback">{feedback ? <><div className="coach-scores">{Object.entries(feedback.scores).map(([label, score]) => <div key={label}><strong>{score}</strong><span>{label}</span></div>)}</div><FeedbackList title="What works" items={feedback.strengths} positive /><FeedbackList title="Improve next" items={feedback.improvements} /><div className="coach-structure"><span>Suggested structure</span><p>{feedback.suggestedStructure}</p></div><small><ShieldCheck size={11} /> {feedback.evidenceIds.length} verified evidence links · {feedback.model}</small></> : <div className="intelligence-empty"><BrainCircuit size={25} /><h3>Your feedback will appear here.</h3><p>A complete answer gets four component scores, evidence links, and an improvement structure.</p></div>}</div></div></>;
}

function FeedbackList({ title, items, positive }: { title: string; items: string[]; positive?: boolean }) { return <div className={`feedback-list ${positive ? "positive" : ""}`}><span>{title}</span>{items.map((item) => <p key={item}>{positive ? <Check size={12} /> : <ChevronRight size={12} />}{item}</p>)}</div>; }

function OutcomeModal({ applications, onClose, onSave }: { applications: JobApplication[]; onClose: () => void; onSave: (outcome: CareerOutcome) => void }) {
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? ""); const [stage, setStage] = useState<CareerOutcome["stage"]>("recruiter_screen"); const [result, setResult] = useState<CareerOutcome["result"]>("advanced"); const [tags, setTags] = useState(""); const [notes, setNotes] = useState(""); const [include, setInclude] = useState(true);
  return <div className="modal-backdrop"><form className="outcome-modal" onSubmit={(event) => { event.preventDefault(); const now = new Date().toISOString(); onSave({ id: `outcome-${crypto.randomUUID()}`, applicationId: applicationId || undefined, stage, result, reasonTags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), notes, occurredAt: now, includeInInsights: include, createdAt: now }); }}><header><div><span>Private feedback loop</span><h2>Log an outcome</h2></div><button aria-label="Close outcome form" type="button" onClick={onClose}><X size={17} /></button></header><label><span>Application</span><select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}><option value="">No linked application</option>{applications.map((application) => <option value={application.id} key={application.id}>{application.role} · {application.company}</option>)}</select></label><div className="form-grid"><label><span>Stage</span><select value={stage} onChange={(event) => setStage(event.target.value as CareerOutcome["stage"])}><option value="application">Application</option><option value="recruiter_screen">Recruiter screen</option><option value="hiring_manager">Hiring manager</option><option value="assessment">Assessment</option><option value="onsite">Onsite/final</option><option value="offer">Offer</option></select></label><label><span>Result</span><select value={result} onChange={(event) => setResult(event.target.value as CareerOutcome["result"])}><option value="pending">Pending</option><option value="advanced">Advanced</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option><option value="accepted">Accepted</option></select></label></div><label><span>Signals or reasons <small>comma-separated</small></span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="strong portfolio, technical depth" /></label><label><span>Private interpretation</span><textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What seemed to help, hurt, or remain uncertain?" /></label><label className="insight-consent"><input type="checkbox" checked={include} onChange={(event) => setInclude(event.target.checked)} /><span><strong>Include in my private insights</strong><small>This does not make the outcome public or anonymous by itself.</small></span></label><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit"><ShieldCheck size={13} /> Save private outcome</button></footer></form></div>;
}

function formatMemoryDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, { month: "short", year: "numeric" }); }

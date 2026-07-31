"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, BriefcaseBusiness, CalendarClock, Check, ChevronRight,
  ClipboardCheck, Clock3, FileCheck2, FileText, Gauge, LayoutDashboard,
  LibraryBig, LoaderCircle, MapPin, MessageSquareText, MoreHorizontal, Plus, Search,
  Send, Sparkles, Target, Trash2, Trophy, UserRoundSearch, X,
} from "lucide-react";
import {
  activeApplicationStatuses,
  buildInterviewPrep,
  demoApplications,
  demoCareerEvidence,
  demoResume,
  type ApplicationActivity,
  type ApplicationStatus,
  type CareerEvidence,
  type InterviewPack,
  type JobApplication,
  type ResumeDocument,
} from "@resumora/domain";
import { Logo } from "@/components/logo";
import {
  generateInterviewPrep,
  loadApplicationActivity,
  loadApplications,
  loadInterviewPack,
  saveApplication,
  saveApplicationActivity,
  saveInterviewPack,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const statusIcons: Record<ApplicationStatus, typeof BriefcaseBusiness> = {
  saved: BriefcaseBusiness,
  preparing: Target,
  applied: Send,
  interview: UserRoundSearch,
  offer: Trophy,
  rejected: X,
  withdrawn: Trash2,
};

type DetailTab = "overview" | "assets" | "interview" | "activity";
type ActivityMap = Record<string, ApplicationActivity[]>;
type InterviewMap = Record<string, InterviewPack>;

export function ApplicationPipeline() {
  const [applications, setApplications] = useState<JobApplication[]>(demoApplications);
  const [activities, setActivities] = useState<ActivityMap>({});
  const [interviewPacks, setInterviewPacks] = useState<InterviewMap>({});
  const [resume, setResume] = useState<ResumeDocument>(demoResume);
  const [evidence, setEvidence] = useState<CareerEvidence[]>(demoCareerEvidence);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [search, setSearch] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<"local" | "syncing" | "synced">("local");
  const [notice, setNotice] = useState<string | null>(null);
  const [openedAt] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedApplications = localStorage.getItem("resumora:applications");
      const storedActivities = localStorage.getItem("resumora:application-activities");
      const storedPacks = localStorage.getItem("resumora:interview-packs");
      const storedResume = localStorage.getItem("resumora:resume");
      const storedEvidence = localStorage.getItem("resumora:career-vault");
      let localApplications: JobApplication[] | null = null;
      if (storedApplications) try { localApplications = JSON.parse(storedApplications); setApplications(localApplications!); } catch { /* keep demo */ }
      if (storedActivities) try { setActivities(JSON.parse(storedActivities)); } catch { /* ignore */ }
      if (storedPacks) try { setInterviewPacks(JSON.parse(storedPacks)); } catch { /* ignore */ }
      if (storedResume) try { setResume(JSON.parse(storedResume)); } catch { /* keep demo */ }
      if (storedEvidence) try { setEvidence(JSON.parse(storedEvidence)); } catch { /* keep demo */ }
      const selected = new URLSearchParams(window.location.search).get("selected");
      if (selected) setSelectedId(selected);
      setHydrated(true);

      const supabase = getSupabaseBrowserClient();
      if (supabase) void supabase.auth.getSession().then(async ({ data }) => {
        const token = data.session?.access_token;
        if (!token) return;
        setAuthToken(token);
        try {
          const cloud = await loadApplications(token);
          if (cloud.data.length) setApplications(() => {
            const byId = new Map(cloud.data.map((item) => [item.id, item]));
            for (const local of localApplications ?? []) {
              const remote = byId.get(local.id);
              if (!remote || new Date(local.updatedAt) > new Date(remote.updatedAt)) byId.set(local.id, local);
            }
            return [...byId.values()];
          });
          setCloudStatus("synced");
        } catch { setCloudStatus("local"); }
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem("resumora:applications", JSON.stringify(applications)); }, [applications, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("resumora:application-activities", JSON.stringify(activities)); }, [activities, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("resumora:interview-packs", JSON.stringify(interviewPacks)); }, [interviewPacks, hydrated]);

  useEffect(() => {
    if (!authToken || !selectedId) return;
    void Promise.all([loadApplicationActivity(selectedId, authToken), loadInterviewPack(selectedId, authToken)])
      .then(([activityResult, packResult]) => {
        if (activityResult.data.length) setActivities((current) => ({ ...current, [selectedId]: activityResult.data }));
        if (packResult.data) setInterviewPacks((current) => ({ ...current, [selectedId]: packResult.data! }));
      })
      .catch(() => undefined);
  }, [authToken, selectedId]);

  const selected = applications.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => applications.filter((application) => {
    const archived = application.status === "rejected" || application.status === "withdrawn";
    if (showArchive !== archived) return false;
    const query = search.trim().toLowerCase();
    return !query || `${application.role} ${application.company} ${application.location}`.toLowerCase().includes(query);
  }), [applications, search, showArchive]);

  const persistApplication = (application: JobApplication) => {
    setApplications((current) => current.some((item) => item.id === application.id)
      ? current.map((item) => item.id === application.id ? application : item)
      : [application, ...current]);
    if (authToken) {
      setCloudStatus("syncing");
      void saveApplication(application, authToken)
        .then(() => setCloudStatus("synced"))
        .catch(() => setCloudStatus("local"));
    }
  };

  const addActivity = (applicationId: string, kind: ApplicationActivity["kind"], message: string, metadata: Record<string, unknown> = {}) => {
    const activity: ApplicationActivity = { id: `activity-${crypto.randomUUID()}`, applicationId, kind, message, metadata, createdAt: new Date().toISOString() };
    setActivities((current) => ({ ...current, [applicationId]: [activity, ...(current[applicationId] ?? [])] }));
    if (authToken) void saveApplicationActivity(activity, authToken).catch(() => undefined);
  };

  const updateApplication = (id: string, patch: Partial<JobApplication>, activityMessage?: string) => {
    const current = applications.find((item) => item.id === id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    persistApplication(next);
    if (activityMessage) addActivity(id, patch.status ? "status" : "note", activityMessage, patch.status ? { status: patch.status } : {});
  };

  const moveForward = (application: JobApplication) => {
    const index = activeApplicationStatuses.indexOf(application.status);
    if (index < 0 || index === activeApplicationStatuses.length - 1) return;
    const status = activeApplicationStatuses[index + 1];
    updateApplication(application.id, {
      status,
      appliedAt: status === "applied" && !application.appliedAt ? new Date().toISOString() : application.appliedAt,
    }, `Moved to ${statusLabels[status]}`);
  };

  const metrics = {
    active: applications.filter((item) => !["rejected", "withdrawn"].includes(item.status)).length,
    interviews: applications.filter((item) => item.status === "interview").length,
    averageMatch: applications.length ? Math.round(applications.reduce((sum, item) => sum + item.matchScore, 0) / applications.length) : 0,
    due: applications.filter((item) => item.nextActionAt && new Date(item.nextActionAt).getTime() < openedAt.getTime() + 3 * 86400000).length,
  };

  return (
    <main className="pipeline-shell">
      <header className="pipeline-topbar">
        <Logo />
        <nav aria-label="Job search workspace">
          <Link className="active" href="/applications"><LayoutDashboard size={15} /> Applications</Link>
          <Link href="/workspace"><Target size={15} /> Tailor a job</Link>
          <Link href="/builder"><FileText size={15} /> Resume editor</Link>
        </nav>
        <div className="pipeline-cloud"><span><Check size={12} /> {cloudStatus === "syncing" ? "Syncing" : cloudStatus === "synced" ? "Private · synced" : "Private · local"}</span><button onClick={() => setNewOpen(true)}><Plus size={15} /> New application</button></div>
      </header>

      <section className="pipeline-hero">
        <div><span className="phase-pill">Phase 3 · Job search command center</span><h1>Every opportunity,<br /><em>under control.</em></h1><p>Keep the job, tailored assets, follow-ups, and interview evidence in one truthful application record.</p></div>
        <div className="pipeline-metrics"><Metric icon={BriefcaseBusiness} value={metrics.active} label="Active applications" /><Metric icon={UserRoundSearch} value={metrics.interviews} label="Interviews" /><Metric icon={Gauge} value={`${metrics.averageMatch}%`} label="Average match" /><Metric icon={CalendarClock} value={metrics.due} label="Actions due soon" /></div>
      </section>

      <section className={`pipeline-workspace ${selected ? "detail-open" : ""}`}>
        <div className="board-area">
          <div className="board-toolbar">
            <div className="pipeline-search"><Search size={15} /><input aria-label="Search applications" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search role, company, or location" /></div>
            <div className="board-toggle"><button className={!showArchive ? "active" : ""} onClick={() => setShowArchive(false)}>Active pipeline</button><button className={showArchive ? "active" : ""} onClick={() => setShowArchive(true)}>Archive</button></div>
          </div>

          {!showArchive ? <div className="kanban-board">{activeApplicationStatuses.map((status) => <KanbanColumn key={status} status={status} applications={filtered.filter((item) => item.status === status)} onSelect={(id) => { setSelectedId(id); setDetailTab("overview"); }} onAdvance={moveForward} />)}</div> : <div className="archive-grid">{filtered.length ? filtered.map((application) => <ApplicationCard key={application.id} application={application} onSelect={() => setSelectedId(application.id)} onAdvance={() => undefined} archive />) : <div className="pipeline-empty">No archived applications.</div>}</div>}
        </div>

        {selected && <ApplicationDetail key={selected.id} application={selected} tab={detailTab} setTab={setDetailTab} activities={activities[selected.id] ?? []} interviewPack={interviewPacks[selected.id]} resume={resume} evidence={evidence} onClose={() => setSelectedId(null)} onUpdate={(patch, message) => updateApplication(selected.id, patch, message)} onAddActivity={(message) => addActivity(selected.id, "review", message)} onInterviewPack={(pack) => { setInterviewPacks((current) => ({ ...current, [selected.id]: pack })); addActivity(selected.id, "interview", `Generated ${pack.questions.length}-question interview pack`, { model: pack.model }); if (authToken) void saveInterviewPack(pack, authToken).catch(() => undefined); }} onNotice={setNotice} />}
      </section>

      {newOpen && <NewApplicationModal onClose={() => setNewOpen(false)} onCreate={(application) => { persistApplication(application); addActivity(application.id, "created", "Application added to pipeline"); setSelectedId(application.id); setNewOpen(false); }} />}
      {notice && <div className="workspace-toast"><span>{notice}</span><button onClick={() => setNotice(null)}><X size={15} /></button></div>}
    </main>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof BriefcaseBusiness; value: string | number; label: string }) {
  return <div><Icon size={16} /><span><strong>{value}</strong><small>{label}</small></span></div>;
}

function KanbanColumn({ status, applications, onSelect, onAdvance }: { status: ApplicationStatus; applications: JobApplication[]; onSelect: (id: string) => void; onAdvance: (application: JobApplication) => void }) {
  const Icon = statusIcons[status];
  return <section className={`kanban-column status-${status}`}><header><span><Icon size={14} />{statusLabels[status]}</span><b>{applications.length}</b></header><div className="kanban-stack">{applications.map((application) => <ApplicationCard key={application.id} application={application} onSelect={() => onSelect(application.id)} onAdvance={() => onAdvance(application)} />)}{applications.length === 0 && <div className="column-empty">No applications</div>}</div></section>;
}

function ApplicationCard({ application, onSelect, onAdvance, archive }: { application: JobApplication; onSelect: () => void; onAdvance: () => void; archive?: boolean }) {
  const canAdvance = !archive && application.status !== "offer";
  return <article className="application-card" onClick={onSelect}><div className="application-card-head"><span>{initials(application.company || application.role)}</span><button aria-label={`More options for ${application.role}`} onClick={(event) => event.stopPropagation()}><MoreHorizontal size={15} /></button></div><h3>{application.role}</h3><strong>{application.company || "Company not added"}</strong>{application.location && <p><MapPin size={11} />{application.location}</p>}<div className="card-signals"><span className={application.matchScore >= 85 ? "strong" : ""}><Gauge size={11} />{application.matchScore}% match</span>{application.resumeId && <span><FileText size={11} />Resume</span>}{application.coverLetterId && <span><FileCheck2 size={11} />Letter</span>}</div>{application.nextAction && <div className="next-action"><Clock3 size={12} /><span><small>Next action</small>{application.nextAction}</span></div>}<footer><time>{relativeDate(application.updatedAt)}</time>{canAdvance && <button aria-label={`Move ${application.role} forward`} onClick={(event) => { event.stopPropagation(); onAdvance(); }}>Advance <ChevronRight size={12} /></button>}</footer></article>;
}

function ApplicationDetail({ application, tab, setTab, activities, interviewPack, resume, evidence, onClose, onUpdate, onAddActivity, onInterviewPack, onNotice }: { application: JobApplication; tab: DetailTab; setTab: (tab: DetailTab) => void; activities: ApplicationActivity[]; interviewPack?: InterviewPack; resume: ResumeDocument; evidence: CareerEvidence[]; onClose: () => void; onUpdate: (patch: Partial<JobApplication>, message?: string) => void; onAddActivity: (message: string) => void; onInterviewPack: (pack: InterviewPack) => void; onNotice: (message: string) => void }) {
  const [notes, setNotes] = useState(application.notes);
  const [nextAction, setNextAction] = useState(application.nextAction);
  const [nextActionAt, setNextActionAt] = useState(application.nextActionAt?.slice(0, 10) ?? "");
  const [reviewNote, setReviewNote] = useState("");
  const [interviewLoading, setInterviewLoading] = useState(false);

  const runInterviewPrep = async () => {
    if (!application.job) { onNotice("Return to the job workspace and analyze the role before generating interview preparation."); return; }
    setInterviewLoading(true);
    try {
      const pack = await generateInterviewPrep(application.id, resume, application.job, evidence.filter((item) => item.verified));
      onInterviewPack(pack);
      if (pack.warning) onNotice(pack.warning);
    } catch {
      const pack = buildInterviewPrep(application.id, application.job, evidence);
      onInterviewPack(pack);
      onNotice("Local evidence-grounded interview preparation was created.");
    } finally { setInterviewLoading(false); }
  };

  return <aside className="application-detail"><header><div><span>{application.company || "Application"}</span><h2>{application.role}</h2><p>{application.location || "Location not added"}</p></div><button aria-label="Close application details" onClick={onClose}><X size={18} /></button></header><nav aria-label="Application details"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button><button className={tab === "assets" ? "active" : ""} onClick={() => setTab("assets")}>Assets</button><button className={tab === "interview" ? "active" : ""} onClick={() => setTab("interview")}>Interview</button><button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>Activity</button></nav><div className="detail-scroll">
    {tab === "overview" && <div className="detail-section"><div className="detail-match"><div className="detail-score"><span>{application.matchScore}</span><small>/100</small></div><div><strong>{application.matchScore >= 85 ? "Strong preparation" : "Worth strengthening"}</strong><p>Resumora job-match signal, not an employer ATS score.</p></div></div><label className="detail-field"><span>Pipeline status</span><select value={application.status} onChange={(event) => { const status = event.target.value as ApplicationStatus; onUpdate({ status, appliedAt: status === "applied" && !application.appliedAt ? new Date().toISOString() : application.appliedAt }, `Moved to ${statusLabels[status]}`); }}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="detail-field"><span>Next action</span><input value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label><label className="detail-field"><span>Due date</span><input type="date" value={nextActionAt} onChange={(event) => setNextActionAt(event.target.value)} /></label><label className="detail-field"><span>Private notes</span><textarea rows={7} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button className="detail-primary" onClick={() => onUpdate({ notes, nextAction, nextActionAt: nextActionAt ? new Date(`${nextActionAt}T09:00:00`).toISOString() : null }, "Updated application plan")}><Check size={14} /> Save application plan</button></div>}
    {tab === "assets" && <div className="detail-section"><SectionIntro icon={ClipboardCheck} title="Application pack" copy="The exact assets associated with this opportunity." /><AssetRow icon={FileText} title="Targeted resume" state={application.resumeId ? "Ready" : "Missing"} action={application.resumeId ? <Link href="/builder">Open editor</Link> : <Link href="/workspace">Create variant</Link>} /><AssetRow icon={FileCheck2} title="Cover letter" state={application.coverLetterId || application.coverLetter ? "Ready" : "Not generated"} action={<Link href="/workspace">Open job workspace</Link>} /><div className="asset-checklist"><span>Before you apply</span><p className={application.resumeId ? "done" : ""}><Check size={12} /> Targeted resume reviewed</p><p className={application.coverLetterId || application.coverLetter ? "done" : ""}><Check size={12} /> Cover letter reviewed</p><p className={application.sourceUrl ? "done" : ""}><Check size={12} /> Original job link retained</p><p className={application.matchScore >= 75 ? "done" : ""}><Check size={12} /> Required-skill gaps reviewed</p></div></div>}
    {tab === "interview" && <div className="detail-section interview-detail"><SectionIntro icon={Sparkles} title="Interview studio" copy="Questions and answer structures grounded in the resume, job, and Career Vault." />{!interviewPack ? <div className="interview-empty"><UserRoundSearch size={28} /><h3>{application.job ? "Prepare for the real questions." : "Job intelligence required"}</h3><p>{application.job ? "Generate a focused pack with evidence links and thoughtful questions for the interviewer." : "Analyze this role in the job workspace so preparation can reflect its actual requirements."}</p>{application.job ? <button onClick={runInterviewPrep} disabled={interviewLoading}>{interviewLoading ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} Generate interview pack</button> : <Link href="/workspace">Analyze target role <ArrowRight size={13} /></Link>}</div> : <><div className="interview-themes"><span>Likely themes</span>{interviewPack.themes.slice(0, 6).map((theme) => <b key={theme}>{theme}</b>)}</div><div className="question-list">{interviewPack.questions.map((question, index) => <article key={question.id}><header><span>{String(index + 1).padStart(2, "0")} · {question.category}</span>{question.evidenceIds.length > 0 ? <b><LibraryBig size={11} />{question.evidenceIds.length} evidence</b> : <small>General</small>}</header><h3>{question.question}</h3><p><strong>Why they ask</strong>{question.whyAsked}</p><p><strong>Answer structure</strong>{question.answerFramework}</p></article>)}</div><div className="ask-interviewer"><span>Questions to ask them</span>{interviewPack.questionsForInterviewer.map((question) => <p key={question}><MessageSquareText size={12} />{question}</p>)}</div><button className="regenerate-pack" onClick={runInterviewPrep} disabled={interviewLoading}>Regenerate with current evidence</button></>}</div>}
    {tab === "activity" && <div className="detail-section"><SectionIntro icon={Activity} title="Decision history" copy="Status changes, review notes, assets, and preparation events." /><form className="activity-form" onSubmit={(event) => { event.preventDefault(); if (!reviewNote.trim()) return; onAddActivity(reviewNote.trim()); setReviewNote(""); }}><textarea rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Add a private review note…" /><button><Plus size={13} /> Add note</button></form><div className="activity-list">{activities.length ? activities.map((item) => <article key={item.id}><i><ActivityIcon kind={item.kind} /></i><div><strong>{item.message}</strong><time>{new Date(item.createdAt).toLocaleString()}</time></div></article>) : <div className="pipeline-empty">No activity recorded yet.</div>}</div></div>}
  </div></aside>;
}

function SectionIntro({ icon: Icon, title, copy }: { icon: typeof Activity; title: string; copy: string }) { return <div className="section-intro"><Icon size={18} /><div><h3>{title}</h3><p>{copy}</p></div></div>; }
function AssetRow({ icon: Icon, title, state, action }: { icon: typeof FileText; title: string; state: string; action: React.ReactNode }) { return <div className="asset-row"><i><Icon size={17} /></i><span><strong>{title}</strong><small>{state}</small></span>{action}</div>; }
function ActivityIcon({ kind }: { kind: ApplicationActivity["kind"] }) { return kind === "status" ? <ChevronRight size={12} /> : kind === "interview" ? <UserRoundSearch size={12} /> : kind === "asset" ? <FileText size={12} /> : <MessageSquareText size={12} />; }

function NewApplicationModal({ onClose, onCreate }: { onClose: () => void; onCreate: (application: JobApplication) => void }) {
  const [role, setRole] = useState(""); const [company, setCompany] = useState(""); const [location, setLocation] = useState(""); const [sourceUrl, setSourceUrl] = useState("");
  return <div className="modal-backdrop"><form className="new-application-modal" onSubmit={(event) => { event.preventDefault(); const now = new Date().toISOString(); onCreate({ id: `application-${crypto.randomUUID()}`, role, company, location, sourceUrl, status: "saved", matchScore: 0, notes: "", nextAction: "Analyze job and prepare application", nextActionAt: null, appliedAt: null, createdAt: now, updatedAt: now }); }}><header><div><span>New opportunity</span><h2>Add to your pipeline</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header><label><span>Role</span><input required value={role} onChange={(event) => setRole(event.target.value)} placeholder="Senior Product Designer" /></label><label><span>Company</span><input required value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" /></label><label><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Dubai · Hybrid" /></label><label><span>Job link</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" /></label><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit"><Plus size={14} /> Add application</button></footer></form></div>;
}

function initials(value: string) { return value.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase(); }
function relativeDate(value: string) { const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)); return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`; }

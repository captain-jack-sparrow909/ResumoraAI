"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BookOpenCheck, BriefcaseBusiness, Check, ChevronRight, CircleAlert,
  FileCheck2, FilePenLine, LibraryBig, LoaderCircle, LockKeyhole,
  Plus, SearchCheck, ShieldCheck, Sparkles, Target, Trash2, WandSparkles, X,
} from "lucide-react";
import {
  demoCareerEvidence,
  demoResume,
  parseJobDescription,
  scoreJobMatch,
  type CareerEvidence,
  type JobAnalysis,
  type ResumeDocument,
  type TailoringProposal,
} from "@resumora/domain";
import { Logo } from "@/components/logo";
import {
  analyzeJobDescription,
  generateCoverLetter,
  getTailoringProposals,
  loadCareerVault,
  saveCareerVault,
  saveJobPosting,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const sampleJob = `Senior Product Designer — Platform
Atlas is building the operating system for modern logistics teams. We are looking for a Senior Product Designer to shape complex B2B workflows across our enterprise platform.

Responsibilities
• Lead customer research and translate insight into product strategy.
• Design end-to-end workflows, prototypes, and polished interaction design.
• Build and evolve a scalable design system with engineering.
• Partner with product management and analytics to define and measure outcomes.

Required qualifications
• 6+ years of product design experience in complex B2B products.
• Advanced Figma, user research, prototyping, and stakeholder management skills.
• Evidence of shipping accessible design systems across multiple teams.

Preferred qualifications
• Experience with Amplitude, A/B testing, or logistics products.
• Experience mentoring designers and facilitating cross-functional workshops.`;

type WorkspaceView = "tailor" | "vault";
type CoverLetter = { subject: string; letter: string; evidenceIds: string[]; unsupportedClaims: string[]; model: string };

export function PhaseTwoWorkspace() {
  const router = useRouter();
  const [view, setView] = useState<WorkspaceView>("tailor");
  const [resume, setResume] = useState<ResumeDocument>(demoResume);
  const [evidence, setEvidence] = useState<CareerEvidence[]>(demoCareerEvidence);
  const [jobText, setJobText] = useState(sampleJob);
  const [job, setJob] = useState<JobAnalysis>(() => parseJobDescription(sampleJob));
  const [jobSource, setJobSource] = useState<"deepseek" | "deterministic">("deterministic");
  const [analyzing, setAnalyzing] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [proposals, setProposals] = useState<TailoringProposal[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newEvidenceOpen, setNewEvidenceOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [vaultDirty, setVaultDirty] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<"local" | "syncing" | "synced">("local");
  const report = useMemo(() => scoreJobMatch(resume, job, evidence), [resume, job, evidence]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedResume = localStorage.getItem("resumora:resume");
      const storedEvidence = localStorage.getItem("resumora:career-vault");
      if (storedResume) {
        try { setResume(JSON.parse(storedResume)); } catch { /* keep demo */ }
      }
      if (storedEvidence) {
        try { setEvidence(JSON.parse(storedEvidence)); } catch { /* keep demo */ }
      }
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        void supabase.auth.getSession().then(async ({ data }) => {
          const token = data.session?.access_token;
          if (!token) return;
          setAuthToken(token);
          try {
            const cloudVault = await loadCareerVault(token);
            if (cloudVault.evidence.length) setEvidence(cloudVault.evidence);
            setCloudStatus("synced");
          } catch { setCloudStatus("local"); }
        });
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    localStorage.setItem("resumora:career-vault", JSON.stringify(evidence));
  }, [evidence]);

  useEffect(() => {
    if (!authToken || !vaultDirty) return;
    const timeout = window.setTimeout(() => {
      setCloudStatus("syncing");
      void saveCareerVault(evidence, authToken)
        .then(() => { setVaultDirty(false); setCloudStatus("synced"); })
        .catch(() => setCloudStatus("local"));
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [authToken, evidence, vaultDirty]);

  const updateEvidence: React.Dispatch<React.SetStateAction<CareerEvidence[]>> = (action) => {
    setEvidence((current) => typeof action === "function" ? action(current) : action);
    setVaultDirty(true);
  };

  async function runJobAnalysis() {
    if (jobText.trim().length < 120) {
      setNotice("Paste a complete job description before analyzing it.");
      return;
    }
    setAnalyzing(true);
    setProposals([]);
    setAccepted([]);
    try {
      const result = await analyzeJobDescription(jobText);
      setJob(result.analysis);
      setJobSource(result.source);
      if (authToken) void saveJobPosting(jobText, result.analysis, authToken).catch(() => undefined);
      if (result.warning) setNotice(result.warning);
    } catch (error) {
      setJob(parseJobDescription(jobText));
      setJobSource("deterministic");
      setNotice(error instanceof Error ? `${error.message}. Local analysis was used.` : "Local analysis was used.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function runTailoring() {
    setTailoring(true);
    try {
      const result = await getTailoringProposals(resume, job, evidence.filter((item) => item.verified));
      setProposals(result.proposals);
      setNotice(`${result.proposals.length} evidence-grounded proposals created with ${result.model}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Tailoring is temporarily unavailable.");
    } finally {
      setTailoring(false);
    }
  }

  async function runCoverLetter() {
    setCoverLoading(true);
    try {
      const result = await generateCoverLetter(resume, job, evidence.filter((item) => item.verified));
      setCoverLetter(result);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cover letter generation is unavailable.");
    } finally {
      setCoverLoading(false);
    }
  }

  function acceptProposal(proposal: TailoringProposal) {
    setResume((current) => {
      if (proposal.target === "headline") return { ...current, basics: { ...current.basics, headline: proposal.suggestion }, updatedAt: new Date().toISOString() };
      if (proposal.target === "summary") return { ...current, summary: proposal.suggestion, updatedAt: new Date().toISOString() };
      if (proposal.target === "experience_bullet" && proposal.experienceId !== undefined && proposal.bulletIndex !== undefined) {
        return {
          ...current,
          experience: current.experience.map((item) => item.id === proposal.experienceId
            ? { ...item, bullets: item.bullets.map((bullet, index) => index === proposal.bulletIndex ? proposal.suggestion : bullet) }
            : item),
          updatedAt: new Date().toISOString(),
        };
      }
      return current;
    });
    setAccepted((current) => [...current, proposal.id]);
  }

  function openTargetedResume() {
    const targeted: ResumeDocument = {
      ...resume,
      id: `resume-${crypto.randomUUID()}`,
      title: `${job.role}${job.company ? ` — ${job.company}` : ""}`,
      sourceResumeId: resume.sourceResumeId ?? resume.id,
      targetJobId: `job-${normalizeId(job.role)}-${Date.now()}`,
      variantType: "targeted",
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("resumora:resume", JSON.stringify(targeted));
    localStorage.setItem("resumora:targeted-context", JSON.stringify({ job, report, evidenceIds: report.evidenceIds }));
    router.push("/builder");
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <Logo />
        <nav aria-label="Career workspace">
          <button className={view === "tailor" ? "active" : ""} onClick={() => setView("tailor")}><Target size={16} /> Tailor to a job</button>
          <button className={view === "vault" ? "active" : ""} onClick={() => setView("vault")}><LibraryBig size={16} /> Career Vault</button>
        </nav>
        <div className="workspace-actions"><span><LockKeyhole size={13} /> {cloudStatus === "syncing" ? "Syncing workspace" : cloudStatus === "synced" ? "Private · synced" : "Private · local"}</span><button onClick={() => router.push("/builder")}>Resume editor <ArrowRight size={15} /></button></div>
      </header>

      {view === "tailor" ? (
        <div className="tailor-layout">
          <aside className="workflow-rail">
            <div className="rail-label">Application workflow</div>
            <WorkflowStep number="01" label="Career evidence" detail={`${evidence.length} verified records`} complete />
            <WorkflowStep number="02" label="Target role" detail={job.role} active />
            <WorkflowStep number="03" label="Resume tailoring" detail={proposals.length ? `${accepted.length}/${proposals.length} accepted` : "Ready to generate"} />
            <WorkflowStep number="04" label="Application pack" detail={coverLetter ? "Cover letter ready" : "Resume + cover letter"} />
            <div className="rail-evidence">
              <ShieldCheck size={18} />
              <div><strong>Evidence coverage</strong><span>{report.evidenceStrength}% grounded</span></div>
              <i><em style={{ width: `${report.evidenceStrength}%` }} /></i>
              <button onClick={() => setView("vault")}>Review Career Vault <ChevronRight size={13} /></button>
            </div>
          </aside>

          <section className="target-workspace">
            <div className="workspace-heading">
              <div><span className="phase-pill">Phase 2 · Job intelligence</span><h1>Build for this opportunity.</h1><p>Resumora separates what the job asks for from what your experience can honestly prove.</p></div>
              <div className="source-badge"><Sparkles size={15} /><span><strong>{jobSource === "deepseek" ? "DeepSeek analysis" : "Local analysis"}</strong><small>{jobSource === "deepseek" ? "Structured by V4 Pro" : "Deterministic fallback"}</small></span></div>
            </div>

            <div className="job-input-card">
              <div className="card-title"><span><BriefcaseBusiness size={17} /> Job description</span><small>{jobText.length.toLocaleString()} characters</small></div>
              <textarea aria-label="Job description" value={jobText} onChange={(event) => setJobText(event.target.value)} rows={9} />
              <div className="job-input-footer"><span><ShieldCheck size={14} /> Pasted text is treated as untrusted data.</span><button onClick={runJobAnalysis} disabled={analyzing}>{analyzing ? <LoaderCircle className="spin" size={16} /> : <SearchCheck size={16} />} Analyze requirements</button></div>
            </div>

            <div className="job-intelligence">
              <div className="intelligence-head"><div><span>Role intelligence</span><h2>{job.role}</h2>{job.company && <p>{job.company}</p>}</div><b>{job.seniority}</b></div>
              <div className="requirement-columns">
                <RequirementGroup title="Required" count={job.requiredSkills.length} items={job.requiredSkills} matched={report.matchedRequired} tone="required" />
                <RequirementGroup title="Preferred" count={job.preferredSkills.length} items={job.preferredSkills} matched={report.matchedPreferred} tone="preferred" />
              </div>
              {job.responsibilities.length > 0 && <div className="responsibility-list"><span>What you would own</span>{job.responsibilities.slice(0, 4).map((item) => <p key={item}><ChevronRight size={13} />{item}</p>)}</div>}
            </div>

            <div className="proposal-section">
              <div className="proposal-section-head"><div><span>Evidence-grounded changes</span><h2>Claim Ledger</h2><p>Every suggestion names the verified records that support it.</p></div><button onClick={runTailoring} disabled={tailoring}>{tailoring ? <LoaderCircle className="spin" size={16} /> : <WandSparkles size={16} />}{proposals.length ? "Regenerate" : "Create proposals"}</button></div>
              {proposals.length === 0 ? <EmptyProposals onGenerate={runTailoring} loading={tailoring} /> : <div className="proposal-list">{proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} evidence={evidence} accepted={accepted.includes(proposal.id)} onAccept={() => acceptProposal(proposal)} onDismiss={() => setProposals((current) => current.filter((item) => item.id !== proposal.id))} />)}</div>}
            </div>
          </section>

          <aside className="match-panel">
            <div className="match-sticky">
              <div className="match-head"><span>Job match</span><small>Not an employer ATS score</small></div>
              <div className="match-score"><ScoreOrb score={report.overall} /><div><strong>{report.overall >= 80 ? "Strong match" : report.overall >= 60 ? "Promising match" : "Needs evidence"}</strong><span>{report.matchedRequired.length}/{job.requiredSkills.length} required skills supported</span></div></div>
              <div className="match-bars"><MatchBar label="Hard skills" value={report.hardSkills} /><MatchBar label="Keyword coverage" value={report.keywordCoverage} /><MatchBar label="Evidence strength" value={report.evidenceStrength} /><MatchBar label="Experience alignment" value={report.experienceAlignment} /></div>
              <div className="gap-box"><span><CircleAlert size={14} /> Priority gaps</span>{report.gaps.length ? report.gaps.slice(0, 4).map((gap) => <div key={`${gap.kind}-${gap.term}`}><i className={gap.severity} /> <p><strong>{gap.term}</strong><small>{gap.kind === "required" ? "Needs verified evidence" : "Preferred by employer"}</small></p></div>) : <p className="no-gaps"><Check size={14} /> No major requirement gaps detected.</p>}</div>
              <div className="application-actions">
                <button className="open-editor" onClick={openTargetedResume}><FilePenLine size={16} /> Open targeted resume <ArrowRight size={14} /></button>
                <button className="cover-action" onClick={runCoverLetter} disabled={coverLoading}>{coverLoading ? <LoaderCircle className="spin" size={15} /> : <FileCheck2 size={15} />} Generate cover letter</button>
              </div>
              <p className="match-disclaimer">Scores measure preparation signals inside Resumora. Hiring systems and recruiters use different criteria.</p>
            </div>
          </aside>
        </div>
      ) : (
        <CareerVault evidence={evidence} setEvidence={updateEvidence} newEvidenceOpen={newEvidenceOpen} setNewEvidenceOpen={setNewEvidenceOpen} onBack={() => setView("tailor")} />
      )}

      {coverLetter && <CoverLetterModal cover={coverLetter} evidence={evidence} onClose={() => setCoverLetter(null)} />}
      {notice && <div className="workspace-toast"><span>{notice}</span><button onClick={() => setNotice(null)}><X size={15} /></button></div>}
    </main>
  );
}

function WorkflowStep({ number, label, detail, complete, active }: { number: string; label: string; detail: string; complete?: boolean; active?: boolean }) {
  return <div className={`workflow-step ${active ? "active" : ""}`}><i>{complete ? <Check size={12} /> : number}</i><span><strong>{label}</strong><small>{detail}</small></span>{active && <em />}</div>;
}

function RequirementGroup({ title, count, items, matched, tone }: { title: string; count: number; items: string[]; matched: string[]; tone: string }) {
  return <div className={`requirement-group ${tone}`}><div><span>{title}</span><b>{count}</b></div><section>{items.length ? items.map((item) => <span className={matched.includes(item) ? "matched" : "missing"} key={item}>{matched.includes(item) ? <Check size={11} /> : <CircleAlert size={11} />}{item}</span>) : <small>No explicit {title.toLowerCase()} skills detected.</small>}</section></div>;
}

function EmptyProposals({ onGenerate, loading }: { onGenerate: () => void; loading: boolean }) {
  return <div className="proposal-empty"><div><BookOpenCheck size={24} /></div><h3>Your original resume is untouched.</h3><p>Generate a small set of high-value changes grounded in verified Career Vault records.</p><button onClick={onGenerate} disabled={loading}>{loading ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} Generate with DeepSeek</button></div>;
}

function ProposalCard({ proposal, evidence, accepted, onAccept, onDismiss }: { proposal: TailoringProposal; evidence: CareerEvidence[]; accepted: boolean; onAccept: () => void; onDismiss: () => void }) {
  const sources = evidence.filter((item) => proposal.evidenceIds.includes(item.id));
  return <article className={`ledger-card ${accepted ? "accepted" : ""}`}><div className="ledger-top"><span>{proposal.target.replace("_", " ")}</span>{accepted ? <b><Check size={12} /> Accepted</b> : <small>{proposal.addedKeywords.length} aligned terms</small>}</div><div className="change-block original"><label>Before</label><p>{proposal.original}</p></div><div className="change-arrow"><ArrowRight size={14} /></div><div className="change-block suggestion"><label>Suggested</label><p>{proposal.suggestion}</p></div><div className="ledger-why"><strong>Why</strong><p>{proposal.rationale}</p></div><div className="evidence-links"><span><ShieldCheck size={13} /> Evidence</span>{sources.map((source) => <b key={source.id}>{source.title}</b>)}{sources.length === 0 && <b className="warning">No linked evidence</b>}</div>{proposal.unsupportedClaims.length > 0 && <div className="unsupported"><CircleAlert size={13} /> Review unsupported language: {proposal.unsupportedClaims.join(", ")}</div>}{!accepted && <div className="ledger-actions"><button onClick={onDismiss}>Dismiss</button><button onClick={onAccept} disabled={sources.length === 0 || proposal.unsupportedClaims.length > 0}><Check size={14} /> Accept verified change</button></div>}</article>;
}

function MatchBar({ label, value }: { label: string; value: number }) {
  return <div><span><b>{label}</b><strong>{value}</strong></span><i><em style={{ width: `${value}%` }} /></i></div>;
}

function ScoreOrb({ score }: { score: number }) {
  return <div className="match-orb" style={{ "--match": `${score * 3.6}deg` } as React.CSSProperties}><span>{score}</span><small>/100</small></div>;
}

function CareerVault({ evidence, setEvidence, newEvidenceOpen, setNewEvidenceOpen, onBack }: { evidence: CareerEvidence[]; setEvidence: React.Dispatch<React.SetStateAction<CareerEvidence[]>>; newEvidenceOpen: boolean; setNewEvidenceOpen: (open: boolean) => void; onBack: () => void }) {
  const verified = evidence.filter((item) => item.verified).length;
  return <div className="vault-layout"><aside className="vault-summary"><span>Career memory</span><h1>Your proof,<br />in one place.</h1><p>The Career Vault preserves details that may not fit on one resume but could matter for the next role.</p><div className="vault-stat"><strong>{evidence.length}</strong><span>Evidence records</span></div><div className="vault-stat"><strong>{verified}</strong><span>Verified by you</span></div><div className="vault-stat"><strong>{new Set(evidence.flatMap((item) => item.skills)).size}</strong><span>Searchable skills</span></div><button onClick={onBack}><Target size={15} /> Return to job match</button></aside><section className="vault-content"><div className="vault-head"><div><span className="phase-pill">Career Vault</span><h2>Evidence library</h2><p>Metrics, projects, and achievements AI is allowed to reference.</p></div><button onClick={() => setNewEvidenceOpen(true)}><Plus size={16} /> Add evidence</button></div>{newEvidenceOpen && <EvidenceForm onCancel={() => setNewEvidenceOpen(false)} onSave={(item) => { setEvidence((current) => [item, ...current]); setNewEvidenceOpen(false); }} />}<div className="evidence-grid">{evidence.map((item) => <article className="evidence-card" key={item.id}><div className="evidence-card-top"><span className={`evidence-type ${item.type}`}>{item.type}</span><button onClick={() => setEvidence((current) => current.filter((record) => record.id !== item.id))}><Trash2 size={14} /></button></div><h3>{item.title}</h3><strong>{item.organization}{item.date ? ` · ${item.date}` : ""}</strong><p>{item.description}</p>{item.metrics.length > 0 && <div className="metric-row">{item.metrics.map((metric) => <b key={metric}>{metric}</b>)}</div>}<div className="skill-row">{item.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><footer><ShieldCheck size={13} /> {item.verified ? "Verified by you" : "Needs verification"}<small>{item.source.replace("_", " ")}</small></footer></article>)}</div></section></div>;
}

function EvidenceForm({ onCancel, onSave }: { onCancel: () => void; onSave: (evidence: CareerEvidence) => void }) {
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [metrics, setMetrics] = useState("");
  return <form className="evidence-form" onSubmit={(event) => { event.preventDefault(); onSave({ id: `evidence-${crypto.randomUUID()}`, type: "achievement", title, organization, description, skills: splitList(skills), metrics: splitList(metrics), date: new Date().getFullYear().toString(), verified: true, source: "user" }); }}><div className="form-title"><span>New verified record</span><button type="button" onClick={onCancel}><X size={16} /></button></div><div className="form-grid"><FormField label="Achievement title" value={title} setValue={setTitle} required /><FormField label="Organization" value={organization} setValue={setOrganization} required /></div><label><span>What happened?</span><textarea required rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe your role, scope, and contribution without embellishment." /></label><div className="form-grid"><FormField label="Skills (comma-separated)" value={skills} setValue={setSkills} /><FormField label="Metrics (comma-separated)" value={metrics} setValue={setMetrics} /></div><div className="form-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="submit"><ShieldCheck size={14} /> Save verified evidence</button></div></form>;
}

function FormField({ label, value, setValue, required }: { label: string; value: string; setValue: (value: string) => void; required?: boolean }) {
  return <label><span>{label}</span><input required={required} value={value} onChange={(event) => setValue(event.target.value)} /></label>;
}

function CoverLetterModal({ cover, evidence, onClose }: { cover: CoverLetter; evidence: CareerEvidence[]; onClose: () => void }) {
  const sources = evidence.filter((item) => cover.evidenceIds.includes(item.id));
  return <div className="modal-backdrop"><section className="cover-modal"><header><div><span>Application pack</span><h2>Tailored cover letter</h2></div><button onClick={onClose}><X size={18} /></button></header><div className="cover-paper"><strong>{cover.subject}</strong>{cover.letter.split(/\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><div className="cover-sources"><span><ShieldCheck size={14} /> Grounded in {sources.length} Career Vault records</span>{sources.map((item) => <b key={item.id}>{item.title}</b>)}</div>{cover.unsupportedClaims.length > 0 && <div className="cover-warning"><CircleAlert size={14} /><span><strong>Review before using</strong>{cover.unsupportedClaims.join(" · ")}</span></div>}<footer><small>Generated with {cover.model}. Review every line before sending.</small><button disabled={cover.unsupportedClaims.length > 0 || sources.length === 0} onClick={() => navigator.clipboard.writeText(cover.letter)}>Copy verified letter</button></footer></section></div>;
}

function splitList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function normalizeId(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50); }

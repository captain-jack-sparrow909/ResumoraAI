"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ResumeAnalysis, ResumeDocument } from "@resumora/domain";
import { analyzeResume, demoResume } from "@resumora/domain";
import {
  ArrowLeft, BrainCircuit, Check, ChevronDown, CircleUserRound, Clock3, Download, FileText,
  GraduationCap, History, LayoutTemplate, LoaderCircle, PanelRightClose,
  LayoutDashboard, PanelRightOpen, Plus, Printer, Save, ScanSearch, Sparkles, Upload, WandSparkles,
  Target, X,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ResumePreview } from "@/components/resume-preview";
import { importResume, rewriteContent, saveResumeRemotely } from "@/lib/api";
import { exportDocx } from "@/lib/export-docx";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { resumeLanguages } from "@/lib/resume-localization";

type SectionId = "basics" | "summary" | "experience" | "education" | "skills" | "design";
type SavedVersion = { id: string; label: string; createdAt: string; resume: ResumeDocument };
type TargetedContext = { job?: { role?: string; company?: string }; report?: { overall?: number } };

const sectionNav: Array<{ id: SectionId; label: string; icon: typeof CircleUserRound }> = [
  { id: "basics", label: "Personal details", icon: CircleUserRound },
  { id: "summary", label: "Professional profile", icon: FileText },
  { id: "experience", label: "Experience", icon: Clock3 },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "design", label: "Design", icon: LayoutTemplate },
];

const templates: Array<{ id: ResumeDocument["template"]; name: string; note: string }> = [
  { id: "slate", name: "Slate", note: "Editorial" },
  { id: "linear", name: "Linear", note: "Minimal" },
  { id: "meridian", name: "Meridian", note: "Modern" },
  { id: "executive", name: "Executive", note: "Classic" },
  { id: "compact", name: "Compact", note: "Dense" },
];

export function BuilderStudio() {
  const [resume, setResume] = useState<ResumeDocument>(demoResume);
  const [activeSection, setActiveSection] = useState<SectionId>("basics");
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  const [status, setStatus] = useState("Saved locally");
  const [notice, setNotice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<{ suggestion: string; rationale: string; model: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [targetedContext, setTargetedContext] = useState<TargetedContext | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const analysis: ResumeAnalysis = useMemo(() => analyzeResume(resume), [resume]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = localStorage.getItem("resumora:resume");
      const storedVersions = localStorage.getItem("resumora:versions");
      const storedTargetedContext = localStorage.getItem("resumora:targeted-context");
      if (stored) {
        try { setResume(JSON.parse(stored)); } catch { /* retain demo */ }
      }
      if (storedVersions) {
        try { setVersions(JSON.parse(storedVersions)); } catch { /* ignore invalid local data */ }
      }
      if (storedTargetedContext) {
        try { setTargetedContext(JSON.parse(storedTargetedContext)); } catch { /* ignore invalid local data */ }
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem("resumora:resume", JSON.stringify(resume));
      setStatus("Saved locally");
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        void supabase.auth.getSession().then(({ data }) => {
          const token = data.session?.access_token;
          if (!token) return;
          setStatus("Syncing…");
          void saveResumeRemotely(resume, token)
            .then(() => setStatus("Synced securely"))
            .catch(() => setStatus("Saved locally"));
        });
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [resume]);

  const update = (recipe: (draft: ResumeDocument) => ResumeDocument) => {
    setResume((current) => recipe({ ...current, updatedAt: new Date().toISOString() }));
  };

  const updateBasics = (field: keyof ResumeDocument["basics"], value: string) => {
    update((current) => ({ ...current, basics: { ...current.basics, [field]: value } }));
  };

  const saveVersion = () => {
    const version: SavedVersion = {
      id: crypto.randomUUID(),
      label: `Snapshot ${versions.length + 1}`,
      createdAt: new Date().toISOString(),
      resume,
    };
    const next = [version, ...versions].slice(0, 12);
    setVersions(next);
    localStorage.setItem("resumora:versions", JSON.stringify(next));
    setNotice("Version snapshot saved.");
  };

  const runAiRewrite = async () => {
    setAiLoading(true);
    setAiProposal(null);
    try {
      const result = await rewriteContent(resume.summary, "summary", resume.basics.headline);
      setAiProposal({ suggestion: result.suggestion, rationale: result.rationale, model: result.model });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI is unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await importResume(file);
      update((current) => ({
        ...current,
        title: file.name.replace(/\.(pdf|docx|txt)$/i, ""),
        basics: {
          ...current.basics,
          fullName: result.extracted.fullName || current.basics.fullName,
          email: result.extracted.email || current.basics.email,
          phone: result.extracted.phone || current.basics.phone,
          links: result.extracted.links.length
            ? result.extracted.links.map((url, index) => ({ label: index === 0 ? "Profile" : `Link ${index + 1}`, url }))
            : current.basics.links,
        },
      }));
      setNotice(`Imported ${result.filename}. Review the extracted details before using them.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <main className="studio-shell">
      <header className="studio-topbar no-print">
        <div className="studio-brand"><Logo compact /><Link href="/"><ArrowLeft size={16} /> Back</Link></div>
        <div className="document-title">
          <input aria-label="Resume title" value={resume.title} onChange={(event) => update((current) => ({ ...current, title: event.target.value }))} />
          <span>
            {resume.variantType === "targeted" && targetedContext?.job?.role
              ? <><Target size={9} /> Targeted for {targetedContext.job.role}{typeof targetedContext.report?.overall === "number" ? ` · ${targetedContext.report.overall}% match` : ""}</>
              : <><i />{status}</>}
          </span>
        </div>
        <div className="top-actions">
          <Link className="button button-quiet studio-button" href="/workspace"><Target size={16} /> Job match</Link>
          <Link className="icon-button" href="/applications" title="Application pipeline"><LayoutDashboard size={18} /></Link>
          <Link className="icon-button" href="/intelligence" title="Career intelligence"><BrainCircuit size={18} /></Link>
          <button className="icon-button" onClick={() => setVersionsOpen((value) => !value)} title="Version history"><History size={18} /></button>
          <button className="button button-quiet studio-button" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />} Import
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(event) => handleImport(event.target.files?.[0])} />
          <div className="export-menu">
            <button className="button button-primary studio-button"><Download size={16} /> Export <ChevronDown size={14} /></button>
            <div className="export-popover">
              <button onClick={() => window.print()}><Printer size={17} /><span><strong>PDF</strong><small>Print-ready, selectable text</small></span></button>
              <button onClick={() => exportDocx(resume)}><FileText size={17} /><span><strong>Word document</strong><small>Editable .docx format</small></span></button>
            </div>
          </div>
        </div>
      </header>

      <div className={`studio-grid ${analysisOpen ? "analysis-visible" : ""}`}>
        <aside className="section-rail no-print">
          <div className="rail-score"><ScoreRing score={analysis.overall} /><span><strong>Readiness</strong><small>Explainable score</small></span></div>
          <nav>
            {sectionNav.map(({ id, label, icon: Icon }) => (
              <button className={activeSection === id ? "active" : ""} key={id} onClick={() => setActiveSection(id)}>
                <Icon size={17} /><span>{label}</span>{sectionReady(id, resume) && <Check className="section-check" size={14} />}
              </button>
            ))}
          </nav>
          <button className="version-button" onClick={saveVersion}><Save size={16} /> Save version</button>
        </aside>

        <section className="editor-panel no-print">
          <EditorHeader activeSection={activeSection} />
          {activeSection === "basics" && <BasicsEditor resume={resume} updateBasics={updateBasics} />}
          {activeSection === "summary" && (
            <SummaryEditor
              resume={resume}
              update={update}
              loading={aiLoading}
              proposal={aiProposal}
              onRewrite={runAiRewrite}
              onAccept={() => {
                if (!aiProposal) return;
                update((current) => ({ ...current, summary: aiProposal.suggestion }));
                setAiProposal(null);
              }}
              onDismiss={() => setAiProposal(null)}
            />
          )}
          {activeSection === "experience" && <ExperienceEditor resume={resume} update={update} />}
          {activeSection === "education" && <EducationEditor resume={resume} update={update} />}
          {activeSection === "skills" && <SkillsEditor resume={resume} update={update} />}
          {activeSection === "design" && <DesignEditor resume={resume} update={update} />}
        </section>

        <section className="preview-panel">
          <div className="preview-toolbar no-print">
            <span>Live preview</span>
            <div><button title="Print PDF" onClick={() => window.print()}><Printer size={16} /></button><button title="Toggle analysis" onClick={() => setAnalysisOpen((value) => !value)}>{analysisOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</button></div>
          </div>
          <div className="paper-stage"><ResumePreview resume={resume} /></div>
        </section>

        {analysisOpen && <AnalysisPanel analysis={analysis} onClose={() => setAnalysisOpen(false)} onNavigate={(field) => field && setActiveSection(field as SectionId)} />}
      </div>

      {versionsOpen && (
        <div className="versions-drawer no-print">
          <div className="drawer-head"><div><span>Version history</span><p>Immutable local snapshots</p></div><button onClick={() => setVersionsOpen(false)}><X size={18} /></button></div>
          {versions.length === 0 ? <div className="empty-state"><History size={24} /><p>No snapshots yet.</p><small>Save a version before a major edit.</small></div> : versions.map((version) => (
            <button className="version-row" key={version.id} onClick={() => { setResume(version.resume); setVersionsOpen(false); setNotice(`${version.label} restored.`); }}>
              <span><strong>{version.label}</strong><small>{new Date(version.createdAt).toLocaleString()}</small></span><ArrowLeft size={15} />
            </button>
          ))}
        </div>
      )}

      {notice && <div className="toast no-print"><span>{notice}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}
    </main>
  );
}

function EditorHeader({ activeSection }: { activeSection: SectionId }) {
  const copy: Record<SectionId, [string, string]> = {
    basics: ["Personal details", "Make it effortless for recruiters to reach you."],
    summary: ["Professional profile", "A clear, evidence-led introduction in a few lines."],
    experience: ["Experience", "Lead with achievements, not a list of duties."],
    education: ["Education", "Add the qualifications relevant to your direction."],
    skills: ["Skills", "Use plain text so people and systems can find them."],
    design: ["Choose a template", "Every option keeps a clean semantic reading order."],
  };
  return <div className="editor-heading"><span>Resume content</span><h1>{copy[activeSection][0]}</h1><p>{copy[activeSection][1]}</p></div>;
}

function BasicsEditor({ resume, updateBasics }: { resume: ResumeDocument; updateBasics: (field: keyof ResumeDocument["basics"], value: string) => void }) {
  return (
    <div className="form-stack">
      <Field label="Full name" value={resume.basics.fullName} onChange={(value) => updateBasics("fullName", value)} placeholder="e.g. Maya Chen" />
      <Field label="Professional headline" value={resume.basics.headline} onChange={(value) => updateBasics("headline", value)} placeholder="e.g. Senior Product Designer" hint="Use the full title a recruiter would search for." />
      <div className="form-grid"><Field label="Email" type="email" value={resume.basics.email} onChange={(value) => updateBasics("email", value)} /><Field label="Phone" value={resume.basics.phone} onChange={(value) => updateBasics("phone", value)} /></div>
      <Field label="Location" value={resume.basics.location} onChange={(value) => updateBasics("location", value)} placeholder="City, country" />
      <div className="subsection-title"><div><h2>Professional links</h2><p>Portfolio, LinkedIn, GitHub, or personal site.</p></div><button><Plus size={15} /> Add</button></div>
      {resume.basics.links.map((link, index) => <div className="link-row" key={`${link.label}-${index}`}><span>{link.label}</span><input value={link.url} onChange={(event) => updateBasics("links", resume.basics.links.map((item, linkIndex) => linkIndex === index ? { ...item, url: event.target.value } : item) as never)} /></div>)}
    </div>
  );
}

function SummaryEditor({ resume, update, loading, proposal, onRewrite, onAccept, onDismiss }: { resume: ResumeDocument; update: (recipe: (draft: ResumeDocument) => ResumeDocument) => void; loading: boolean; proposal: { suggestion: string; rationale: string; model: string } | null; onRewrite: () => void; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="form-stack">
      <div className="ai-callout"><WandSparkles size={19} /><div><strong>Truth-preserving AI</strong><p>Resumora improves what you wrote without fabricating achievements.</p></div></div>
      <label className="field"><span>Profile summary <small>{resume.summary.length}/520</small></span><textarea rows={9} maxLength={520} value={resume.summary} onChange={(event) => update((current) => ({ ...current, summary: event.target.value }))} /></label>
      <button className="button button-ai" onClick={onRewrite} disabled={loading || resume.summary.length < 10}>{loading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Improve with DeepSeek</button>
      {proposal && <div className="proposal-card"><div className="proposal-head"><span>AI suggestion</span><small>{proposal.model}</small></div><p>{proposal.suggestion}</p><div className="proposal-reason"><strong>Why this is stronger</strong>{proposal.rationale}</div><div className="proposal-actions"><button onClick={onDismiss}>Keep original</button><button onClick={onAccept}><Check size={15} /> Accept change</button></div></div>}
    </div>
  );
}

function ExperienceEditor({ resume, update }: EditorProps) {
  return <div className="form-stack">{resume.experience.map((item, index) => <div className="entry-editor" key={item.id}><div className="entry-number"><span>{String(index + 1).padStart(2, "0")}</span><button onClick={() => update((current) => ({ ...current, experience: current.experience.filter((entry) => entry.id !== item.id) }))}><X size={15} /></button></div><div className="form-grid"><Field label="Role" value={item.role} onChange={(value) => updateExperience(update, item.id, "role", value)} /><Field label="Company" value={item.company} onChange={(value) => updateExperience(update, item.id, "company", value)} /></div><div className="form-grid"><Field label="Start" type="month" value={item.startDate} onChange={(value) => updateExperience(update, item.id, "startDate", value)} /><Field label="End" value={item.endDate} onChange={(value) => updateExperience(update, item.id, "endDate", value)} /></div><Field label="Location" value={item.location} onChange={(value) => updateExperience(update, item.id, "location", value)} /><div className="bullet-editor"><span>Achievements</span>{item.bullets.map((bullet, bulletIndex) => <div key={`${item.id}-${bulletIndex}`}><i>•</i><textarea rows={2} value={bullet} onChange={(event) => update((current) => ({ ...current, experience: current.experience.map((entry) => entry.id === item.id ? { ...entry, bullets: entry.bullets.map((value, idx) => idx === bulletIndex ? event.target.value : value) } : entry) }))} /></div>)}<button onClick={() => update((current) => ({ ...current, experience: current.experience.map((entry) => entry.id === item.id ? { ...entry, bullets: [...entry.bullets, ""] } : entry) }))}><Plus size={14} /> Add achievement</button></div></div>)}<button className="add-entry" onClick={() => update((current) => ({ ...current, experience: [...current.experience, { id: crypto.randomUUID(), company: "", role: "", location: "", startDate: "", endDate: "", current: false, bullets: [""] }] }))}><Plus size={17} /> Add experience</button></div>;
}

function EducationEditor({ resume, update }: EditorProps) {
  return <div className="form-stack">{resume.education.map((item, index) => <div className="entry-editor" key={item.id}><div className="entry-number"><span>{String(index + 1).padStart(2, "0")}</span></div><Field label="Institution" value={item.institution} onChange={(value) => update((current) => ({ ...current, education: current.education.map((entry) => entry.id === item.id ? { ...entry, institution: value } : entry) }))} /><div className="form-grid"><Field label="Degree" value={item.degree} onChange={(value) => updateEducation(update, item.id, "degree", value)} /><Field label="Field of study" value={item.field} onChange={(value) => updateEducation(update, item.id, "field", value)} /></div><div className="form-grid"><Field label="Graduation year" value={item.endDate} onChange={(value) => updateEducation(update, item.id, "endDate", value)} /><Field label="Location" value={item.location} onChange={(value) => updateEducation(update, item.id, "location", value)} /></div></div>)}</div>;
}

function SkillsEditor({ resume, update }: EditorProps) {
  return <div className="form-stack"><div className="ai-callout neutral"><ScanSearch size={19} /><div><strong>Searchable, not decorative</strong><p>Skills are exported as plain text and grouped for faster scanning.</p></div></div>{resume.skills.map((group) => <div className="skill-editor" key={group.id}><Field label="Group name" value={group.name} onChange={(value) => update((current) => ({ ...current, skills: current.skills.map((entry) => entry.id === group.id ? { ...entry, name: value } : entry) }))} /><label className="field"><span>Skills <small>Separate with commas</small></span><textarea rows={3} value={group.items.join(", ")} onChange={(event) => update((current) => ({ ...current, skills: current.skills.map((entry) => entry.id === group.id ? { ...entry, items: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } : entry) }))} /></label></div>)}</div>;
}

function DesignEditor({ resume, update }: EditorProps) {
  const language = resume.language ?? "en";
  const direction = resume.direction ?? "ltr";
  return <div className="design-settings"><div className="document-settings"><label><span>Document language</span><select value={language} onChange={(event) => { const selected = resumeLanguages.find((item) => item.id === event.target.value)!; update((current) => ({ ...current, language: selected.id, direction: selected.direction })); }}>{resumeLanguages.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Translates structural headings and date formatting. Your content remains unchanged.</small></label><label><span>Text direction</span><select value={direction} onChange={(event) => update((current) => ({ ...current, direction: event.target.value as ResumeDocument["direction"] }))}><option value="ltr">Left to right</option><option value="rtl">Right to left</option></select><small>Use RTL for Arabic and other right-to-left content.</small></label></div><div className="template-grid">{templates.map((template) => <button className={resume.template === template.id ? "selected" : ""} key={template.id} onClick={() => update((current) => ({ ...current, template: template.id }))}><div className={`template-thumb thumb-${template.id}`}><i /><i /><i /><i /></div><span><strong>{template.name}</strong><small>{template.note} · ATS safe</small></span>{resume.template === template.id && <Check size={15} />}</button>)}</div></div>;
}

function AnalysisPanel({ analysis, onClose, onNavigate }: { analysis: ResumeAnalysis; onClose: () => void; onNavigate: (field?: string) => void }) {
  return <aside className="analysis-panel no-print"><div className="analysis-head"><div><span>Resume check</span><p>Updated live</p></div><button onClick={onClose}><X size={17} /></button></div><div className="analysis-overview"><ScoreRing score={analysis.overall} large /><div><strong>{analysis.overall >= 85 ? "Strong foundation" : "Worth another pass"}</strong><p>This is guidance—not an employer ATS score.</p></div></div><div className="score-breakdown"><ScoreBar label="Machine readability" score={analysis.machineReadability} /><ScoreBar label="Recruiter quality" score={analysis.recruiterQuality} /><ScoreBar label="Completeness" score={analysis.completeness} /></div><div className="findings-list"><span>Checks</span>{analysis.findings.map((finding) => <button key={finding.id} onClick={() => onNavigate(finding.field)}><i className={finding.severity}>{finding.severity === "pass" ? <Check size={13} /> : "!"}</i><span><strong>{finding.title}</strong><small>{finding.explanation}</small></span></button>)}</div></aside>;
}

function ScoreRing({ score, large = false }: { score: number; large?: boolean }) {
  return <div className={`mini-score ${large ? "large" : ""}`} style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><span>{score}</span></div>;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return <div><span><b>{label}</b><strong>{score}</strong></span><i><em style={{ width: `${score}%` }} /></i></div>;
}

function Field({ label, value, onChange, placeholder, hint, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; hint?: string; type?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />{hint && <small>{hint}</small>}</label>;
}

type EditorProps = { resume: ResumeDocument; update: (recipe: (draft: ResumeDocument) => ResumeDocument) => void };

function updateExperience(update: EditorProps["update"], id: string, field: "role" | "company" | "location" | "startDate" | "endDate", value: string) {
  update((current) => ({ ...current, experience: current.experience.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry) }));
}

function updateEducation(update: EditorProps["update"], id: string, field: "degree" | "field" | "location" | "endDate", value: string) {
  update((current) => ({ ...current, education: current.education.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry) }));
}

function sectionReady(section: SectionId, resume: ResumeDocument) {
  if (section === "basics") return Boolean(resume.basics.fullName && resume.basics.email);
  if (section === "summary") return resume.summary.length >= 80;
  if (section === "experience") return resume.experience.some((item) => item.role && item.company);
  if (section === "education") return resume.education.some((item) => item.institution);
  if (section === "skills") return resume.skills.some((group) => group.items.length >= 3);
  return true;
}

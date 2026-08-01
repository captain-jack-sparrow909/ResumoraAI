"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleAlert, FileSearch, Linkedin, LockKeyhole, ShieldCheck, UserRoundSearch } from "lucide-react";
import { checkProfileConsistency, demoResume, type ResumeDocument } from "@resumora/domain";
import { Logo } from "@/components/logo";

const sampleProfile = `Maya Chen
Senior Product Designer

Northstar Labs — Senior Product Designer
Mar 2022 – Present

Arc Commerce — Product Designer
Jul 2018 – Feb 2022

Skills: Product strategy, User research, Interaction design, Prototyping, Design systems, Figma, FigJam, Amplitude`;

export function ProfileConsistencyChecker() {
  const [resume, setResume] = useState<ResumeDocument>(demoResume);
  const [profileText, setProfileText] = useState(sampleProfile);
  const [checkedText, setCheckedText] = useState(sampleProfile);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = localStorage.getItem("resumora:resume");
      if (stored) try { setResume(JSON.parse(stored)); } catch { /* retain demo */ }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const report = useMemo(() => checkProfileConsistency(resume, checkedText), [resume, checkedText]);

  return <main className="consistency-shell">
    <header><Logo /><nav><Link href="/builder"><ArrowLeft size={14} /> Resume editor</Link><Link href="/applications">Applications</Link></nav><span><LockKeyhole size={12} /> Private · checked in your browser</span></header>
    <section className="consistency-hero"><div><span className="phase-pill">Phase 3 · Profile consistency</span><h1>Make every career profile tell the <em>same true story.</em></h1><p>Compare your active resume with text copied from LinkedIn or another professional profile. Resumora flags differences; it never logs in, scrapes, or changes your profile.</p></div><div className="consistency-score"><strong>{report.overall}</strong><span>Consistency signal</span><small>Guidance, not a recruiter score</small></div></section>
    <section className="consistency-grid">
      <div className="profile-input-card"><div><Linkedin size={18} /><span><strong>Profile text</strong><small>Paste your public profile or exported text</small></span></div><textarea rows={22} value={profileText} onChange={(event) => setProfileText(event.target.value)} /><button onClick={() => setCheckedText(profileText)}><FileSearch size={15} /> Check consistency</button><p><ShieldCheck size={13} /> This check is deterministic and runs locally. No profile credentials are requested.</p></div>
      <div className="consistency-report"><div className="consistency-summary"><div><span>{report.aligned}</span><small>Aligned</small></div><div><span>{report.review}</span><small>Review</small></div><div><span>{report.missing}</span><small>Missing</small></div></div><div className="consistency-source"><UserRoundSearch size={17} /><span><strong>{resume.basics.fullName}</strong><small>{resume.title} · active resume</small></span></div><div className="consistency-findings">{report.findings.map((finding) => <article key={finding.id} className={finding.severity}><i>{finding.severity === "aligned" ? <Check size={13} /> : <CircleAlert size={13} />}</i><div><span>{finding.category}</span><strong>{finding.title}</strong><p>{finding.explanation}</p></div></article>)}</div></div>
    </section>
  </main>;
}

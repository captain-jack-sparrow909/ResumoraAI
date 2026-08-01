"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Eye, Globe2, LayoutDashboard, Link2, LockKeyhole, Palette, Save, ShieldCheck, Sparkles } from "lucide-react";
import { buildPublicPortfolio, demoCareerEvidence, demoResume, portfolioPublicationSchema, type CareerEvidence, type PortfolioPublication, type ResumeDocument } from "@resumora/domain";
import { Logo } from "@/components/logo";
import { loadPortfolioPublication, savePortfolioPublication } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const initialPublication: PortfolioPublication = portfolioPublicationSchema.parse({
  id: "portfolio-primary",
  slug: "maya-chen",
  displayName: demoResume.basics.fullName,
  headline: demoResume.basics.headline,
  bio: demoResume.summary,
  location: demoResume.basics.location,
  evidenceIds: demoCareerEvidence.filter((item) => item.verified).slice(0, 3).map((item) => item.id),
  featuredSkills: demoResume.skills.flatMap((group) => group.items).slice(0, 8),
  linkUrls: demoResume.basics.links.filter((link) => /^https?:\/\//i.test(link.url)).map((link) => link.url),
  theme: "editorial",
  showEmail: false,
  contactEmail: demoResume.basics.email,
  status: "draft",
  updatedAt: new Date().toISOString(),
});

export function PortfolioStudio() {
  const [resume, setResume] = useState<ResumeDocument>(demoResume);
  const [evidence, setEvidence] = useState<CareerEvidence[]>(demoCareerEvidence);
  const [publication, setPublication] = useState<PortfolioPublication>(initialPublication);
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState("Draft changes stay in this browser until you sign in.");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; } };
      setResume(read("resumora:resume", demoResume));
      setEvidence(read("resumora:career-vault", demoCareerEvidence));
      const localPublication = portfolioPublicationSchema.safeParse(read<unknown>("resumora:portfolio", initialPublication));
      setPublication(localPublication.success ? localPublication.data : initialPublication);
      const supabase = getSupabaseBrowserClient();
      if (supabase) void supabase.auth.getSession().then(async ({ data }) => {
        const accessToken = data.session?.access_token;
        if (!accessToken) return;
        setToken(accessToken);
        try { const remote = await loadPortfolioPublication(accessToken); if (remote.publication) setPublication(remote.publication); setNotice("Private draft synced."); } catch { setNotice("Cloud draft could not be loaded; local editing remains available."); }
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const verified = evidence.filter((item) => item.verified);
  const preview = useMemo(() => buildPublicPortfolio(publication, resume, verified), [publication, resume, verified]);
  const update = (patch: Partial<PortfolioPublication>) => {
    const next = { ...publication, ...patch, updatedAt: new Date().toISOString() };
    setPublication(next); localStorage.setItem("resumora:portfolio", JSON.stringify(next));
  };
  const toggleEvidence = (id: string) => update({ evidenceIds: publication.evidenceIds.includes(id) ? publication.evidenceIds.filter((item) => item !== id) : [...publication.evidenceIds, id] });
  const persist = async (status: "draft" | "published" | "revoked") => {
    if (!token) { setNotice(status === "draft" ? "Draft saved locally. Sign in to sync it." : "Sign in before publishing a public address."); return; }
    setSaving(true);
    try {
      const result = await savePortfolioPublication({ ...publication, status, updatedAt: new Date().toISOString() }, token);
      setPublication(result.publication); localStorage.setItem("resumora:portfolio", JSON.stringify(result.publication));
      setNotice(status === "published" ? "Portfolio published from this approved snapshot." : status === "revoked" ? "Public access revoked immediately." : "Private draft synced.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the publication."); }
    finally { setSaving(false); }
  };

  return <main className="portfolio-studio-shell">
    <header className="portfolio-studio-topbar"><Logo /><nav><Link href="/intelligence"><Sparkles size={14} /> Intelligence</Link><Link href="/organizations"><LayoutDashboard size={14} /> Organizations</Link><Link href="/builder"><Save size={14} /> Resume</Link></nav><span><LockKeyhole size={12} /> {token ? "Private draft · synced" : "Private draft · local"}</span></header>
    <section className="portfolio-studio-hero"><div><span>Phase 4 · Proof publishing</span><h1>A portfolio built from <em>approved evidence</em>, not copied claims.</h1><p>Select the exact Career Vault records you want public. Publishing creates a fixed snapshot, so later private edits never leak automatically.</p></div><div className="publish-state"><Globe2 size={19} /><span><strong>{publication.status === "published" ? "Public" : publication.status === "revoked" ? "Revoked" : "Private draft"}</strong>{publication.evidenceIds.length} approved records selected</span>{publication.status === "published" && <Link href={`/p/${publication.slug}`} target="_blank">View site <ArrowUpRight size={13} /></Link>}</div></section>
    <div className="portfolio-studio-grid"><section className="portfolio-controls"><div className="studio-section-heading"><span>Identity</span><h2>Shape the public narrative.</h2></div><div className="portfolio-form-grid"><label><span>Public name</span><input value={publication.displayName} onChange={(event) => update({ displayName: event.target.value })} /></label><label><span>Public address</span><div className="slug-input"><b>/p/</b><input aria-label="Public address" value={publication.slug} onChange={(event) => update({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") })} /></div></label></div><label><span>Headline</span><input value={publication.headline} onChange={(event) => update({ headline: event.target.value })} /></label><label><span>About</span><textarea rows={5} value={publication.bio} onChange={(event) => update({ bio: event.target.value })} /></label><div className="portfolio-form-grid"><label><span>Location</span><input value={publication.location} onChange={(event) => update({ location: event.target.value })} /></label><label><span>Theme</span><select value={publication.theme} onChange={(event) => update({ theme: event.target.value as PortfolioPublication["theme"] })}><option value="editorial">Editorial</option><option value="minimal">Minimal</option><option value="contrast">High contrast</option></select></label></div><label className="portfolio-email-consent"><input type="checkbox" checked={publication.showEmail} onChange={(event) => update({ showEmail: event.target.checked })} /><span><strong>Show contact email</strong><small>Off by default. Phone numbers are never published.</small></span></label>
      <div className="portfolio-links-consent"><span>Public links</span>{resume.basics.links.filter((link) => /^https?:\/\//i.test(link.url)).map((link) => <label key={link.url}><input type="checkbox" checked={publication.linkUrls.includes(link.url)} onChange={(event) => update({ linkUrls: event.target.checked ? [...publication.linkUrls, link.url] : publication.linkUrls.filter((url) => url !== link.url) })} /><span><strong>{link.label}</strong><small>{link.url}</small></span></label>)}</div><div className="studio-section-heading evidence-heading"><span>Approved proof</span><h2>Choose what leaves the vault.</h2><p>Only verified records can be selected. Every published card is a snapshot of the text shown here.</p></div><div className="publication-evidence-list">{verified.map((item) => { const selected = publication.evidenceIds.includes(item.id); return <button aria-pressed={selected} className={selected ? "selected" : ""} key={item.id} onClick={() => toggleEvidence(item.id)}><i>{selected ? <Check size={13} /> : <ShieldCheck size={13} />}</i><span><strong>{item.title}</strong><small>{item.organization} · {item.skills.slice(0, 3).join(" · ")}</small><p>{item.description}</p></span></button>; })}</div>
      <div className="publication-actions"><button onClick={() => void persist("draft")} disabled={saving}><Save size={14} /> Save private draft</button>{publication.status === "published" ? <button className="danger" onClick={() => void persist("revoked")} disabled={saving}>Revoke public access</button> : <button className="primary" onClick={() => void persist("published")} disabled={saving || !publication.evidenceIds.length}><Globe2 size={14} /> Publish approved snapshot</button>}</div><p className="portfolio-notice"><ShieldCheck size={13} />{notice}</p></section>
      <aside className="portfolio-live-preview"><header><span><Eye size={13} /> Live preview</span><b><Palette size={13} /> {publication.theme}</b></header><PublicPortfolioPreview portfolio={preview} /></aside></div>
  </main>;
}

export function PublicPortfolioPreview({ portfolio }: { portfolio: ReturnType<typeof buildPublicPortfolio> }) {
  return <article className={`public-portfolio theme-${portfolio.theme}`}><header><span>Selected work · {portfolio.location}</span><h1>{portfolio.displayName}</h1><h2>{portfolio.headline}</h2><p>{portfolio.bio}</p><div>{portfolio.links.slice(0, 3).map((link) => <a href={link.url} key={link.url}><Link2 size={11} />{link.label}</a>)}{portfolio.contactEmail && <a href={`mailto:${portfolio.contactEmail}`}>{portfolio.contactEmail}</a>}</div></header><section><span>Capabilities</span><div className="public-skills">{portfolio.featuredSkills.map((skill) => <b key={skill}>{skill}</b>)}</div></section><section><span>Evidence-backed work</span><div className="public-projects">{portfolio.projects.map((project, index) => <article key={project.id}><i>{String(index + 1).padStart(2, "0")}</i><div><small>{project.organization} · {project.date}</small><h3>{project.title}</h3><p>{project.description}</p><footer>{project.metrics.map((metric) => <strong key={metric}>{metric}</strong>)}{project.skills.slice(0, 4).map((skill) => <b key={skill}>{skill}</b>)}</footer></div></article>)}</div></section><footer><ShieldCheck size={13} /> Published from explicitly approved, verified career evidence.</footer></article>;
}

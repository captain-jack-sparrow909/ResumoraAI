import Link from "next/link";
import { ArrowRight, Check, FileCheck2, Fingerprint, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";

const qualities = [
  {
    icon: FileCheck2,
    number: "01",
    title: "Readable by machines",
    copy: "Semantic templates, clean exports, and checks that explain what an ATS can actually extract.",
  },
  {
    icon: Fingerprint,
    number: "02",
    title: "Sounds unmistakably you",
    copy: "AI improves your phrasing while every claim stays anchored to experience you can defend.",
  },
  {
    icon: Sparkles,
    number: "03",
    title: "Ready for the next role",
    copy: "Build one trusted career profile, then shape it for each opportunity without starting again.",
  },
];

export default function Home() {
  return (
    <main className="landing">
      <nav className="site-nav shell">
        <Logo />
        <div className="nav-links" aria-label="Main navigation">
          <a href="#method">How it works</a>
          <a href="#standards">Our standard</a>
          <Link href="/workspace">Job workspace</Link>
          <Link href="/applications">Applications</Link>
          <Link href="/intelligence">Career intelligence</Link>
          <Link href="/portfolio">Portfolio</Link>
          <Link href="/organizations">Organizations</Link>
        </div>
        <Link className="button button-quiet" href="/login">Sign in</Link>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Resume intelligence, grounded in truth</div>
          <h1>Your career has a story.<br /><em>Make every line count.</em></h1>
          <p className="hero-lede">
            Create a beautiful, machine-readable resume with guidance you can understand and AI that never invents your experience.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/builder">Build my resume <ArrowRight size={17} /></Link>
            <Link className="hero-text-link" href="/workspace">Tailor an existing resume <ArrowRight size={14} /></Link>
          </div>
          <span className="micro-proof hero-proof"><Check size={15} /> No card required · Your original resume stays untouched</span>
          <div className="trust-row">
            <div><strong>3-part</strong><span>explainable score</span></div>
            <div><strong>5</strong><span>ATS-safe templates</span></div>
            <div><strong>100%</strong><span>editable content</span></div>
          </div>
        </div>

        <div className="hero-visual" aria-label="Resumora resume analysis preview">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="floating-card score-card">
            <div className="score-dial"><span>92</span><small>/100</small></div>
            <div><strong>Application ready</strong><p>Clear, credible, readable.</p></div>
          </div>
          <div className="resume-card">
            <div className="resume-card-top"><span>MC</span><i /></div>
            <h2>Maya Chen</h2>
            <p>Senior Product Designer</p>
            <div className="fake-section wide" />
            <div className="fake-lines"><i /><i /><i /></div>
            <div className="fake-section" />
            <div className="fake-job"><b /><span><i /><i /></span></div>
            <div className="fake-job"><b /><span><i /><i /></span></div>
          </div>
          <div className="floating-card truth-card"><ShieldCheck size={18} /><span><strong>Claim checked</strong><small>Grounded in your experience</small></span></div>
        </div>
      </section>

      <section className="principle-band" id="standards">
        <div className="shell principle-inner">
          <span>The Resumora standard</span>
          <p>Not a mysterious ATS score. Three clear signals that help you make a stronger decision.</p>
          <div className="signal-pills"><b>Machine readability</b><b>Recruiter quality</b><b>Completeness</b></div>
        </div>
      </section>

      <section className="method shell" id="method">
        <div className="section-heading">
          <div className="eyebrow"><span /> Built for the way hiring works</div>
          <h2>Proof before polish.<br />Clarity before cleverness.</h2>
        </div>
        <div className="quality-grid">
          {qualities.map(({ icon: Icon, number, title, copy }) => (
            <article className="quality-card" key={title}>
              <div className="quality-top"><span>{number}</span><Icon size={23} /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="closing shell">
        <div>
          <span className="eyebrow light"><span /> Your next chapter</span>
          <h2>Start with what you’ve done.<br />Build what comes next.</h2>
        </div>
        <Link className="button button-paper" href="/builder">Enter the studio <ArrowRight size={17} /></Link>
      </section>

      <footer className="site-footer shell">
        <Logo />
        <p>Truthful resumes. Clearer opportunities.</p>
        <span>© 2026 Resumora AI</span>
      </footer>
    </main>
  );
}

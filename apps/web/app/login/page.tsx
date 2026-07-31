"use client";

import { useState } from "react";
import { ArrowLeft, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase is not configured yet. You can continue in local studio mode.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/builder` },
    });
    setLoading(false);
    setMessage(error ? error.message : "Check your inbox for a secure sign-in link.");
  }

  return (
    <main className="login-page">
      <header><Logo /><Link href="/"><ArrowLeft size={15} /> Home</Link></header>
      <section className="login-card">
        <div className="login-icon"><Mail size={21} /></div>
        <span className="eyebrow"><span /> Your private workspace</span>
        <h1>Welcome to<br />Resumora.</h1>
        <p>Use a secure email link to sync your career profile and resume versions across devices.</p>
        <form onSubmit={submit}>
          <label className="field"><span>Email address</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <button className="button button-primary" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <Mail size={17} />} Email me a sign-in link</button>
        </form>
        {message && <div className="login-message">{message}</div>}
        <Link className="local-link" href="/builder">Continue without an account</Link>
        <div className="privacy-note"><ShieldCheck size={16} /><span><strong>Your resume stays yours.</strong><small>No training on your content by default.</small></span></div>
      </section>
    </main>
  );
}

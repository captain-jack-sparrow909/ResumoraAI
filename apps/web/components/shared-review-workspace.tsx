"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, FileText, LoaderCircle, MessageSquareText, ShieldCheck } from "lucide-react";
import { resumeSchema, type ApplicationReview } from "@resumora/domain";
import { Logo } from "@/components/logo";
import { ResumePreview } from "@/components/resume-preview";
import { loadSharedReview, submitSharedReview, type SharedReviewPayload } from "@/lib/api";

export function SharedReviewWorkspace({ token }: { token: string }) {
  const [payload, setPayload] = useState<SharedReviewPayload | null>(null);
  const [error, setError] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [decision, setDecision] = useState<"comment" | "approved" | "changes_requested">("comment");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { void loadSharedReview(token).then((result) => { setPayload(result); setAuthorName(result.invitation.reviewerName); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not open review")); }, [token]);

  async function submit() {
    if (authorName.trim().length < 2 || body.trim().length < 2) return;
    setSubmitting(true);
    try {
      const result = await submitSharedReview(token, { authorName: authorName.trim(), body: body.trim(), decision });
      setPayload((current) => current ? { ...current, reviews: [result.review, ...current.reviews] } : current);
      setBody(""); setDecision("comment");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit feedback"); }
    finally { setSubmitting(false); }
  }

  if (error && !payload) return <main className="shared-review-error"><Logo /><CircleAlert size={32} /><h1>Review link unavailable</h1><p>{error}</p></main>;
  if (!payload) return <main className="shared-review-loading"><LoaderCircle className="spin" size={26} /> Opening secure review…</main>;
  const parsedResume = payload.invitation.target === "resume" ? resumeSchema.safeParse(payload.asset) : null;

  return <main className="shared-review-shell"><header><Logo /><div><span>{payload.application.company || "Application"}</span><strong>{payload.application.role}</strong></div><p><ShieldCheck size={13} /> Scoped review · expires {new Date(payload.invitation.expiresAt).toLocaleDateString()}</p></header><div className="shared-review-grid"><section className="shared-asset"><div className="shared-asset-heading"><FileText size={16} /><span><strong>{payload.invitation.target.replace("_", " ")} review</strong><small>Read-only shared asset</small></span></div>{parsedResume?.success ? <div className="shared-resume-stage"><ResumePreview resume={parsedResume.data} /></div> : <SharedTextAsset asset={payload.asset} target={payload.invitation.target} />}</section><aside className="review-compose"><span className="phase-pill">External feedback</span><h1>Review with context.</h1><p>Comment on the shared asset only. The owner’s private Career Vault and other applications are never included.</p><label><span>Your name</span><input value={authorName} onChange={(event) => setAuthorName(event.target.value)} /></label><div className="decision-picker"><button className={decision === "comment" ? "active" : ""} onClick={() => setDecision("comment")}><MessageSquareText size={13} /> Comment</button><button className={decision === "approved" ? "active" : ""} onClick={() => setDecision("approved")}><Check size={13} /> Approve</button><button className={decision === "changes_requested" ? "active" : ""} onClick={() => setDecision("changes_requested")}><CircleAlert size={13} /> Request changes</button></div><label><span>Feedback</span><textarea rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Be specific, actionable, and mindful that every claim must remain truthful." /></label><button className="submit-review" onClick={submit} disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />} Submit feedback</button>{error && <div className="review-error">{error}</div>}<ReviewHistory reviews={payload.reviews} /></aside></div></main>;
}

function SharedTextAsset({ asset, target }: { asset: unknown; target: string }) {
  if (target === "cover_letter" && asset && typeof asset === "object") {
    const letter = asset as { subject?: string; letter?: string };
    return <article className="shared-letter"><h2>{letter.subject || "Cover letter"}</h2>{(letter.letter || "No cover letter was attached.").split(/\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>;
  }
  const application = asset && typeof asset === "object" ? asset as { role?: string; company?: string; location?: string; status?: string; matchScore?: number; sourceUrl?: string } : {};
  return <article className="shared-application"><span>Application overview</span><h2>{application.role}</h2><strong>{application.company}</strong><dl><dt>Status</dt><dd>{application.status}</dd><dt>Location</dt><dd>{application.location || "Not specified"}</dd><dt>Preparation signal</dt><dd>{application.matchScore ?? 0}/100</dd><dt>Source</dt><dd>{application.sourceUrl ? <a href={application.sourceUrl} target="_blank" rel="noreferrer">Open job page</a> : "Not shared"}</dd></dl></article>;
}

function ReviewHistory({ reviews }: { reviews: ApplicationReview[] }) {
  return <div className="shared-review-history"><span>Submitted feedback</span>{reviews.length ? reviews.map((review) => <article key={review.id} className={review.decision}><div><strong>{review.authorName}</strong><small>{review.decision.replace("_", " ")}</small></div><p>{review.body}</p><time>{new Date(review.createdAt).toLocaleString()}</time></article>) : <p className="no-feedback">No feedback submitted yet.</p>}</div>;
}

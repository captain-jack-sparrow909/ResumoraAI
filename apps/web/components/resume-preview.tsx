import type { ResumeDocument } from "@resumora/domain";
import { Globe2, Mail, MapPin, Phone } from "lucide-react";

const formatDate = (date: string) => {
  if (!date || date === "Present") return date;
  if (/^\d{4}$/.test(date)) return date;
  const [year, month] = date.split("-");
  const value = new Date(Number(year), Number(month) - 1);
  return Number.isNaN(value.valueOf()) ? date : value.toLocaleDateString("en", { month: "short", year: "numeric" });
};

export function ResumePreview({ resume }: { resume: ResumeDocument }) {
  return (
    <article className={`resume-paper template-${resume.template}`} id="resume-document">
      <header className="paper-header">
        <div className="paper-monogram">{resume.basics.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("") || "R"}</div>
        <div>
          <h1>{resume.basics.fullName || "Your name"}</h1>
          <p>{resume.basics.headline || "Professional headline"}</p>
        </div>
      </header>
      <div className="paper-contact">
        {resume.basics.email && <span><Mail />{resume.basics.email}</span>}
        {resume.basics.phone && <span><Phone />{resume.basics.phone}</span>}
        {resume.basics.location && <span><MapPin />{resume.basics.location}</span>}
        {resume.basics.links[0]?.url && <span><Globe2 />{resume.basics.links[0].url}</span>}
      </div>

      {resume.summary && <PaperSection title="Profile"><p className="paper-summary">{resume.summary}</p></PaperSection>}

      {resume.experience.length > 0 && (
        <PaperSection title="Experience">
          <div className="paper-stack">
            {resume.experience.map((item) => (
              <div className="paper-entry" key={item.id}>
                <div className="paper-entry-head">
                  <div><h3>{item.role}</h3><strong>{item.company}</strong></div>
                  <div className="paper-date"><span>{formatDate(item.startDate)} — {item.current ? "Present" : formatDate(item.endDate)}</span><small>{item.location}</small></div>
                </div>
                <ul>{item.bullets.filter(Boolean).map((bullet, index) => <li key={`${item.id}-${index}`}>{bullet}</li>)}</ul>
              </div>
            ))}
          </div>
        </PaperSection>
      )}

      {resume.education.length > 0 && (
        <PaperSection title="Education">
          {resume.education.map((item) => (
            <div className="paper-entry-head education-row" key={item.id}>
              <div><h3>{item.degree}{item.field ? ` in ${item.field}` : ""}</h3><strong>{item.institution}</strong></div>
              <div className="paper-date"><span>{item.endDate}</span><small>{item.location}</small></div>
            </div>
          ))}
        </PaperSection>
      )}

      {resume.skills.length > 0 && (
        <PaperSection title="Skills">
          <div className="paper-skills">
            {resume.skills.map((group) => <p key={group.id}><strong>{group.name}</strong><span>{group.items.join(" · ")}</span></p>)}
          </div>
        </PaperSection>
      )}
    </article>
  );
}

function PaperSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="paper-section"><h2>{title}</h2>{children}</section>;
}

import type { ResumeDocument } from "@resumora/domain";
import { Globe2, Mail, MapPin, Phone } from "lucide-react";
import { resumeLabels } from "@/lib/resume-localization";

const localeFor = { en: "en", ar: "ar", fr: "fr", es: "es", de: "de", pt: "pt" } as const;
const formatDate = (date: string, language: keyof typeof localeFor) => {
  if (!date || date === "Present") return date;
  if (/^\d{4}$/.test(date)) return date;
  const [year, month] = date.split("-");
  const value = new Date(Number(year), Number(month) - 1);
  return Number.isNaN(value.valueOf()) ? date : value.toLocaleDateString(localeFor[language], { month: "short", year: "numeric" });
};

export function ResumePreview({ resume }: { resume: ResumeDocument }) {
  const language = resume.language ?? "en";
  const direction = resume.direction ?? (language === "ar" ? "rtl" : "ltr");
  const labels = resumeLabels[language];
  return (
    <article className={`resume-paper template-${resume.template}`} id="resume-document" lang={language} dir={direction}>
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

      {resume.summary && <PaperSection title={labels.profile}><p className="paper-summary">{resume.summary}</p></PaperSection>}

      {resume.experience.length > 0 && (
        <PaperSection title={labels.experience}>
          <div className="paper-stack">
            {resume.experience.map((item) => (
              <div className="paper-entry" key={item.id}>
                <div className="paper-entry-head">
                  <div><h3>{item.role}</h3><strong>{item.company}</strong></div>
                  <div className="paper-date"><span>{formatDate(item.startDate, language)} — {item.current ? labels.present : formatDate(item.endDate, language)}</span><small>{item.location}</small></div>
                </div>
                <ul>{item.bullets.filter(Boolean).map((bullet, index) => <li key={`${item.id}-${index}`}>{bullet}</li>)}</ul>
              </div>
            ))}
          </div>
        </PaperSection>
      )}

      {resume.education.length > 0 && (
        <PaperSection title={labels.education}>
          {resume.education.map((item) => (
            <div className="paper-entry-head education-row" key={item.id}>
              <div><h3>{item.degree}{item.field ? ` ${labels.in} ${item.field}` : ""}</h3><strong>{item.institution}</strong></div>
              <div className="paper-date"><span>{item.endDate}</span><small>{item.location}</small></div>
            </div>
          ))}
        </PaperSection>
      )}

      {resume.skills.length > 0 && (
        <PaperSection title={labels.skills}>
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

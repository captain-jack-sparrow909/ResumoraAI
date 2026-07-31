import type { ResumeDocument } from "@resumora/domain";

export async function exportDocx(resume: ResumeDocument) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
  } = await import("docx");

  const contact = [resume.basics.email, resume.basics.phone, resume.basics.location]
    .filter(Boolean)
    .join("  •  ");
  const sections: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: resume.basics.fullName, bold: true, size: 36, color: "163B3A" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: resume.basics.headline, size: 22, color: "334E4D" })],
      spacing: { after: 50 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contact, size: 18, color: "536967" })],
      spacing: { after: 250 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C8D8D4" } },
    }),
    sectionHeading("Professional summary", Paragraph, TextRun, HeadingLevel),
    new Paragraph({ text: resume.summary, spacing: { after: 220, line: 280 } }),
    sectionHeading("Experience", Paragraph, TextRun, HeadingLevel),
  ];

  for (const item of resume.experience) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: item.role, bold: true, size: 22 }),
          new TextRun({ text: `  |  ${item.company}`, bold: true, size: 22, color: "2E6763" }),
        ],
        spacing: { before: 100, after: 30 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `${item.startDate} – ${item.current ? "Present" : item.endDate}  •  ${item.location}`, italics: true, size: 18, color: "536967" })],
        spacing: { after: 40 },
      }),
      ...item.bullets.filter(Boolean).map((bullet) => new Paragraph({ text: bullet, bullet: { level: 0 }, spacing: { after: 50, line: 260 } })),
    );
  }

  sections.push(sectionHeading("Education", Paragraph, TextRun, HeadingLevel));
  for (const item of resume.education) {
    sections.push(new Paragraph({
      children: [
        new TextRun({ text: `${item.degree}${item.field ? ` in ${item.field}` : ""}`, bold: true }),
        new TextRun({ text: ` — ${item.institution}, ${item.endDate}`, color: "536967" }),
      ],
      spacing: { after: 100 },
    }));
  }

  sections.push(sectionHeading("Skills", Paragraph, TextRun, HeadingLevel));
  for (const group of resume.skills) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: `${group.name}: `, bold: true }), new TextRun(group.items.join(", "))],
      spacing: { after: 70 },
    }));
  }

  const document = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20, color: "1B2928" }, paragraph: { spacing: { line: 260 } } } } },
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children: sections }],
  });
  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${resume.basics.fullName || "resume"}.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sectionHeading(
  title: string,
  ParagraphClass: typeof import("docx").Paragraph,
  TextRunClass: typeof import("docx").TextRun,
  heading: typeof import("docx").HeadingLevel,
) {
  return new ParagraphClass({
    heading: heading.HEADING_2,
    children: [new TextRunClass({ text: title.toUpperCase(), bold: true, size: 18, color: "2E6763" })],
    spacing: { before: 120, after: 80 },
    border: { bottom: { style: "single" as never, size: 3, color: "C8D8D4" } },
  });
}

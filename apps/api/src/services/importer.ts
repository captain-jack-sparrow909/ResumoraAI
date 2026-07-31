import mammoth from "mammoth";
import pdf from "pdf-parse";

export async function extractResumeText(buffer: Buffer, mimeType: string, filename: string) {
  const lowerName = filename.toLowerCase();
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return (await pdf(buffer)).text;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return (await mammoth.extractRawText({ buffer })).value;
  }
  if (mimeType === "text/plain" || lowerName.endsWith(".txt")) return buffer.toString("utf8");
  throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT.");
}

export function inferBasics(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? "";
  const links = [...text.matchAll(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|[a-z0-9-]+\.(?:com|dev|io|me))\/[^\s,;]+/gi)]
    .slice(0, 4)
    .map((match) => match[0].replace(/[.)]+$/, ""));
  return {
    fullName: lines[0]?.length <= 80 ? lines[0] : "",
    email,
    phone,
    links,
    rawText: text.slice(0, 30_000),
  };
}

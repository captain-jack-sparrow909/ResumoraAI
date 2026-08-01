import type { DocumentLanguage } from "@resumora/domain";

export const resumeLanguages: Array<{ id: DocumentLanguage; name: string; direction: "ltr" | "rtl" }> = [
  { id: "en", name: "English", direction: "ltr" },
  { id: "ar", name: "العربية", direction: "rtl" },
  { id: "fr", name: "Français", direction: "ltr" },
  { id: "es", name: "Español", direction: "ltr" },
  { id: "de", name: "Deutsch", direction: "ltr" },
  { id: "pt", name: "Português", direction: "ltr" },
];

export const resumeLabels: Record<DocumentLanguage, { profile: string; experience: string; education: string; skills: string; present: string; in: string }> = {
  en: { profile: "Profile", experience: "Experience", education: "Education", skills: "Skills", present: "Present", in: "in" },
  ar: { profile: "الملف المهني", experience: "الخبرة", education: "التعليم", skills: "المهارات", present: "حتى الآن", in: "في" },
  fr: { profile: "Profil", experience: "Expérience", education: "Formation", skills: "Compétences", present: "Aujourd’hui", in: "en" },
  es: { profile: "Perfil", experience: "Experiencia", education: "Educación", skills: "Habilidades", present: "Actualidad", in: "en" },
  de: { profile: "Profil", experience: "Berufserfahrung", education: "Ausbildung", skills: "Kenntnisse", present: "Heute", in: "in" },
  pt: { profile: "Perfil", experience: "Experiência", education: "Formação", skills: "Competências", present: "Atual", in: "em" },
};

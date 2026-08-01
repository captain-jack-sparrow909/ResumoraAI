import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resumora AI — Build proof, not buzzwords",
  description: "Create truthful, ATS-readable resumes with explainable guidance and AI grounded in your real experience.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

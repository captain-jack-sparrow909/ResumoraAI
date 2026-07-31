import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resumora AI — Build proof, not buzzwords",
  description: "Create truthful, ATS-readable resumes with explainable guidance and AI grounded in your real experience.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

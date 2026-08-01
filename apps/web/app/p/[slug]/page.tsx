import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPortfolioPreview } from "@/components/portfolio-studio";
import { loadPublicPortfolio } from "@/lib/api";

async function getPortfolio(slug: string) {
  try { return (await loadPublicPortfolio(slug)).portfolio; } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = await getPortfolio(slug);
  if (!portfolio) return { title: "Portfolio not found · ResumoraAI", robots: { index: false, follow: false } };
  return {
    title: `${portfolio.displayName} — ${portfolio.headline}`,
    description: portfolio.bio.slice(0, 155),
    alternates: { canonical: `/p/${portfolio.slug}` },
    openGraph: { title: portfolio.displayName, description: portfolio.headline, type: "profile" },
  };
}

export default async function PublicPortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const portfolio = await getPortfolio(slug);
  if (!portfolio) notFound();
  return <main className="public-portfolio-page"><PublicPortfolioPreview portfolio={portfolio} /></main>;
}

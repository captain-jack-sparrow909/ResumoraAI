import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Resumora home">
      <span className="brand-mark" aria-hidden="true">
        <span>R</span>
      </span>
      {!compact && <span className="brand-name">Resumora<span>AI</span></span>}
    </Link>
  );
}

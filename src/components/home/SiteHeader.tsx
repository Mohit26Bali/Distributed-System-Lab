import Link from "next/link";
import { Activity } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="glow-accent flex h-7 w-7 items-center justify-center rounded-md bg-sky-400/15"
            style={{ "--accent": "#3dff8a" } as React.CSSProperties}
          >
            <Activity size={15} className="text-sky-400" aria-hidden="true" />
          </span>
          <span className="font-display text-sm font-semibold tracking-wide text-text-primary">Distributed Systems Lab</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6 text-xs text-text-secondary">
          <a href="#modules" className="readout hidden transition hover:text-sky-400 sm:inline">
            Modules
          </a>
          <a href="#why" className="readout hidden transition hover:text-sky-400 sm:inline">
            Why this simulator
          </a>
          <Link
            href="/modules/introduction"
            className="readout rounded-sm border border-sky-400/40 px-3 py-1.5 text-sky-400 transition hover:bg-sky-400/10"
          >
            Start learning
          </Link>
        </nav>
      </div>
    </header>
  );
}

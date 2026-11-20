import Link from "next/link";
import { Activity } from "lucide-react";
import { HERO_PHOTOS } from "@/lib/hero-photos";
import { LEARNING_PATH_ORDER } from "@/app/landingModuleMeta";
import { MODULE_REGISTRY } from "@/store/moduleRegistry";

export function SiteFooter() {
  const modules = LEARNING_PATH_ORDER.map((id) => ({ id, title: MODULE_REGISTRY[id]?.title })).filter(
    (m): m is { id: string; title: string } => Boolean(m.title),
  );
  const photographers = Array.from(new Map(HERO_PHOTOS.map((p) => [p.photographer, p.page])));

  return (
    <footer className="w-full border-t border-border-subtle bg-bg-canvas/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-[1.2fr_2fr]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="font-display flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Activity size={14} className="text-sky-400" aria-hidden="true" />
            Distributed Systems Lab
          </Link>
          <p className="max-w-xs text-xs leading-relaxed text-text-muted">
            Ten deterministic simulation engines. Every packet, crash and commit on screen really happened in the
            simulation.
          </p>
        </div>
        <nav aria-label="Modules">
          <h2 className="readout mb-3 text-[11px] text-sky-400">Modules</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-text-secondary sm:grid-cols-3">
            {modules.map((m) => (
              <li key={m.id}>
                <Link href={`/modules/${m.id}`} className="transition hover:text-sky-400">
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border-subtle">
        <p className="mx-auto max-w-6xl px-6 py-4 text-[11px] leading-relaxed text-text-muted">
          Photos from{" "}
          <a href="https://www.pexels.com" className="underline hover:text-sky-400" target="_blank" rel="noopener noreferrer">
            Pexels
          </a>
          :{" "}
          {photographers.map(([name, page], i) => (
            <span key={name}>
              <a href={page} className="underline hover:text-sky-400" target="_blank" rel="noopener noreferrer">
                {name}
              </a>
              {i < photographers.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </div>
    </footer>
  );
}

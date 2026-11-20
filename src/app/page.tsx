import Link from "next/link";
import { GraduationCap, Play, Repeat, ShieldAlert, RotateCcw } from "lucide-react";

import { BackToTop } from "@/components/home/BackToTop";
import { PhotoHero } from "@/components/home/PhotoHero";
import { ModulesAccordion } from "@/components/home/ModulesAccordion";
import { ScrollReveal } from "@/components/home/ScrollReveal";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteHeader } from "@/components/home/SiteHeader";
import { MODULE_REGISTRY } from "@/store/moduleRegistry";
import { LEARNING_PATH_GROUPS, LEARNING_PATH_ORDER } from "./landingModuleMeta";

const FEATURES = [
  {
    icon: Repeat,
    title: "Deterministic",
    body: "Same input, same result, every time — nothing here is randomized in a way you can't reproduce.",
  },
  {
    icon: RotateCcw,
    title: "Replayable",
    body: "Step backward and forward through every event on the timeline, at any point in the run.",
  },
  {
    icon: ShieldAlert,
    title: "Fault Injection",
    body: "Kill nodes, drop packets, partition the network — and watch the algorithm actually cope with it.",
  },
  {
    icon: GraduationCap,
    title: "Guided Learning",
    body: "Interactive explanations, predictive quizzes, and hands-on challenges alongside every simulation.",
  },
];

const MODULE_GROUPS = LEARNING_PATH_GROUPS.map((group) => ({
  label: group.label,
  modules: group.ids
    .map((id) => {
      const moduleDef = MODULE_REGISTRY[id];
      if (!moduleDef) return null;
      return { id, title: moduleDef.title, summary: moduleDef.summary };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null),
}));

export default function Home() {
  const moduleCount = LEARNING_PATH_ORDER.length;

  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col py-10">
        <div className="mx-auto w-full max-w-6xl px-6">
          <PhotoHero>
            <div className="flex flex-col items-center lg:flex-row lg:items-center">
              <div className="hero-text flex flex-col items-center gap-5 text-center lg:w-[30rem] lg:shrink-0 lg:items-start lg:text-left">
                <span className="readout rounded-sm border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-[11px] text-sky-400">
                  CH1 · Distributed systems, visually
                </span>
                <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-text-primary sm:text-5xl">
                  Learn Distributed Systems by <span className="trace-glow text-sky-400">Watching Them Happen</span>
                </h1>
                <p className="text-base text-text-secondary sm:text-lg">
                  Build intuition through deterministic simulations, replay, fault injection, and
                  interactive challenges — not another slide deck.
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <Link
                    href="/modules/introduction"
                    className="glow-accent flex items-center gap-2 rounded-md bg-sky-400 px-5 py-2.5 text-sm font-semibold text-[#06130d] transition hover:bg-sky-300"
                    style={{ "--accent": "#3dff8a" } as React.CSSProperties}
                  >
                    <Play size={15} fill="currentColor" />
                    Start Learning
                  </Link>
                  <a
                    href="#modules"
                    className="flex items-center gap-2 rounded-md border border-sky-400/40 bg-bg-canvas/60 px-5 py-2.5 text-sm text-text-primary transition hover:border-sky-400 hover:text-sky-400"
                  >
                    Explore Modules
                  </a>
                </div>
                <div className="readout mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-text-secondary lg:justify-start">
                  <span>{moduleCount} modules</span>
                  <span>400+ tests</span>
                  <span>Deterministic engine</span>
                </div>
              </div>
            </div>
          </PhotoHero>
        </div>

        <div
          id="modules"
          className="mx-auto mt-28 w-full max-w-6xl scroll-mt-20 border-t border-border-subtle px-6 pt-16 sm:mt-32"
        >
          <ScrollReveal className="mb-6 flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-wider text-sky-400 uppercase">Modules</h2>
            <p className="max-w-2xl text-sm text-text-muted">
              Ten modules, each one a real simulator — from a two-node network up through
              consensus, quorum, and a key-value store built entirely from Raft.
            </p>
          </ScrollReveal>
          <ModulesAccordion groups={MODULE_GROUPS} />
        </div>

        <div
          id="why"
          className="mx-auto mt-24 w-full max-w-6xl scroll-mt-20 border-t border-border-subtle px-6 pt-16"
        >
          <ScrollReveal className="mb-6 flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-wider text-sky-400 uppercase">Why This Simulator</h2>
            <p className="max-w-2xl text-sm text-text-muted">
              Built like a professional developer tool, not a slideshow — because the engine
              underneath is a real one.
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <ScrollReveal key={title} delay={Math.min(i, 6) * 0.04}>
                <div className="glass flex h-full flex-col gap-3 p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-400/12 text-sky-400">
                    <Icon size={18} />
                  </span>
                  <h3 className="font-medium text-text-primary">{title}</h3>
                  <p className="text-sm text-text-muted">{body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
      <BackToTop />
    </>
  );
}

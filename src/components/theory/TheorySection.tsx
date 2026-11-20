import type { ReactNode } from "react";

/**
 * One "chapter" inside a TheoryDialog. Deliberately simpler than the
 * sibling project this pattern was ported from: that project's sims run a
 * fixed, scripted program, so a theory section could show a "Watch cycle
 * N" button that jumps the live playback to an exact, always-true cycle
 * number. This project's simulations are open-ended sandboxes — the
 * learner chooses what to do and when, so there is no canonical tick a
 * theory section could jump to. Prose only; instructions say what to try,
 * not a button that does it for you.
 */
export function TheorySection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="mb-5 border-b border-border-subtle pb-5 last:mb-0 last:border-0 last:pb-0">
      <h4 className="mb-1.5 text-sm font-medium text-sky-400">{heading}</h4>
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-text-muted">{children}</div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";

export function GuidedStep() {
  const moduleId = useSimulationStore((state) => state.moduleId);
  const events = useSimulationStore((state) => state.events);
  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;
  const steps = definition?.guidedSteps ?? [];

  const [stepIndex, setStepIndex] = useState(0);
  // events.length at the moment the current step began — never resets
  // backward, so an event from an earlier step can never satisfy a later one.
  const [stepStartCount, setStepStartCount] = useState(0);

  // This component remounts on every module switch (keyed by moduleId in
  // ExplanationPane), so this fires once per module load — scrolling the
  // first guided step into view and briefly highlighting it, since it's
  // easy to press Play without ever scrolling past the Write/Submit
  // controls above it and noticing it's there at all. scrollIntoView's
  // "smooth" is a JS-driven behavior, not CSS — the global reduced-motion
  // media query can't touch it, so it needs its own check, same reasoning
  // as usePrefersReducedMotion.ts's own doc comment.
  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    containerRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
    // Only ever on mount (once per module load) — deliberately not
    // re-running when prefersReducedMotion changes mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (steps.length === 0) return null;

  if (stepIndex >= steps.length) {
    return (
      <div className="rounded border border-emerald-500/40 bg-bg-elevated p-3">
        <p className="text-xs text-emerald-400">
          Guided steps complete — try the sandbox freely from here.
        </p>
      </div>
    );
  }

  const currentStep = steps[stepIndex];
  const satisfied = currentStep.isSatisfied(events.slice(stepStartCount));

  function goToNext() {
    setStepIndex((i) => i + 1);
    setStepStartCount(events.length);
  }

  return (
    <div
      ref={containerRef}
      className="guided-step-highlight space-y-2 rounded border border-border-subtle bg-bg-elevated p-3"
    >
      <p className="text-xs font-medium text-text-secondary">
        Guided step {stepIndex + 1} of {steps.length}
      </p>
      <p className="text-sm text-text-primary">{currentStep.instruction}</p>
      {satisfied && <p className="text-xs text-emerald-400">{currentStep.observation}</p>}
      <button
        type="button"
        onClick={goToNext}
        className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary hover:bg-bg-canvas"
      >
        {satisfied ? "Next step" : "Skip"}
      </button>
    </div>
  );
}

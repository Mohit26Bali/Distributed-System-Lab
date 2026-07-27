"use client";

import { useState } from "react";

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
    <div className="space-y-2 rounded border border-border-subtle bg-bg-elevated p-3">
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

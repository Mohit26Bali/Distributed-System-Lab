"use client";

import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";

export function ExplanationPane() {
  const moduleId = useSimulationStore((state) => state.moduleId);
  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;

  if (!definition) {
    return <p className="text-xs text-text-muted">Loading module…</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-text-secondary">{definition.title}</h2>
      {definition.description.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed text-text-muted">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

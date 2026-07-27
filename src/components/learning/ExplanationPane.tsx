"use client";

import { NetworkConfigPanel } from "@/components/controls/NetworkConfigPanel";
import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";

import { Challenge } from "./Challenge";
import { GuidedStep } from "./GuidedStep";
import { Quiz } from "./Quiz";

export function ExplanationPane() {
  const moduleId = useSimulationStore((state) => state.moduleId);
  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;

  if (!definition) {
    return <p className="text-xs text-text-muted">Loading module…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-text-secondary">{definition.title}</h2>
        {definition.description.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-text-muted">
            {paragraph}
          </p>
        ))}
      </div>
      <NetworkConfigPanel key={`${moduleId}-network-config`} />
      {/* Keyed by moduleId so switching modules resets guided/quiz progress
          instead of carrying stale state into a different module. */}
      <GuidedStep key={moduleId} />
      {definition.quiz && <Quiz key={`${moduleId}-quiz`} quiz={definition.quiz} />}
      {definition.challenges?.map((challenge) => (
        <Challenge key={challenge.id} challenge={challenge} />
      ))}
    </div>
  );
}

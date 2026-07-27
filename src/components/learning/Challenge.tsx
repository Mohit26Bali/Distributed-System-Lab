"use client";

import type { ChallengeDefinition } from "@/store/challenges";
import { useSimulationStore } from "@/store/simulationStore";

interface ChallengeProps {
  challenge: ChallengeDefinition;
}

export function Challenge({ challenge }: ChallengeProps) {
  const events = useSimulationStore((state) => state.events);
  const complete = challenge.isComplete(events);

  return (
    <div
      className={`space-y-1 rounded border p-3 ${
        complete ? "border-emerald-500/40 bg-bg-elevated" : "border-border-subtle bg-bg-elevated"
      }`}
    >
      <p className="text-xs font-medium text-text-secondary">{challenge.title}</p>
      <p className="text-sm text-text-primary">{challenge.prompt}</p>
      <p className={`text-xs ${complete ? "text-emerald-400" : "text-text-muted"}`}>
        {complete ? "Complete." : "Not complete yet."}
      </p>
    </div>
  );
}

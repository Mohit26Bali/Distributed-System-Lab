"use client";

import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";

/**
 * Send Ping between this module's first two configured nodes. Extracted
 * from a hardcoded panel that used to live directly in
 * SimulationCanvas.tsx (present there since Milestone 5) — moved out
 * during the Replication module's Milestone 31 so it follows the same
 * per-module `*Controls` pattern as ElectionControls/RaftControls/
 * ReplicationControls, instead of being the one hardcoded exception
 * rendered unconditionally on every module's canvas.
 */
export function NetworkingControls() {
  const moduleId = useSimulationStore((state) => state.moduleId);
  const dispatch = useSimulationStore((state) => state.dispatch);
  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;

  if (!definition) return null;
  const [firstNodeId, secondNodeId] = definition.nodeIds;

  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "SEND_PING", from: firstNodeId, to: secondNodeId })}
      className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary hover:bg-bg-canvas"
    >
      Send Ping {firstNodeId.toUpperCase()}→{secondNodeId.toUpperCase()}
    </button>
  );
}

"use client";

import { Vote } from "lucide-react";

import { useSimulationStore } from "@/store/simulationStore";
import { useUiStore } from "@/store/uiStore";

/**
 * Temporary trigger for Milestone 15 — no guided content exists for this
 * module yet (that's Milestone 18), so this is the only way to dispatch
 * START_ELECTION, mirroring how Milestone 5's networking module used a
 * temporary "Send Ping" button before guided steps existed.
 */
export function ElectionControls() {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const dispatch = useSimulationStore((state) => state.dispatch);

  return (
    <button
      type="button"
      disabled={!selectedNodeId}
      onClick={() => selectedNodeId && dispatch({ type: "START_ELECTION", nodeId: selectedNodeId })}
      className="flex items-center gap-1.5 rounded border border-sky-500/40 bg-bg-panel px-2 py-1 text-xs text-sky-400 hover:bg-sky-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-panel"
    >
      <Vote size={14} />
      Start Election{selectedNodeId ? ` (node ${selectedNodeId})` : ""}
    </button>
  );
}

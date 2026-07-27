"use client";

import { Skull, Unplug } from "lucide-react";

import { useSimulationStore } from "@/store/simulationStore";
import { useUiStore } from "@/store/uiStore";

const FAULT_BUTTON_CLASS =
  "flex items-center gap-1.5 rounded border border-red-500/40 bg-bg-panel px-2 py-1 text-xs text-red-400 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-panel";

export function FaultInjectionMenu() {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectedMessageId = useUiStore((state) => state.selectedMessageId);
  const dispatch = useSimulationStore((state) => state.dispatch);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!selectedNodeId}
        onClick={() => selectedNodeId && dispatch({ type: "KILL_NODE", nodeId: selectedNodeId })}
        className={FAULT_BUTTON_CLASS}
      >
        <Skull size={14} />
        Kill Node{selectedNodeId ? ` ${selectedNodeId.toUpperCase()}` : ""}
      </button>

      <button
        type="button"
        disabled={!selectedMessageId}
        onClick={() =>
          selectedMessageId && dispatch({ type: "DROP_MESSAGE", messageId: selectedMessageId })
        }
        className={FAULT_BUTTON_CLASS}
      >
        <Unplug size={14} />
        Drop Message{selectedMessageId ? ` ${selectedMessageId}` : ""}
      </button>
    </div>
  );
}

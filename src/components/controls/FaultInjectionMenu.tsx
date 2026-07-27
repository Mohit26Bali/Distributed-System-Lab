"use client";

import { Copy, Shuffle, Skull, Unplug, Waypoints } from "lucide-react";

import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";
import { useUiStore } from "@/store/uiStore";

const FAULT_BUTTON_CLASS =
  "flex items-center gap-1.5 rounded border border-red-500/40 bg-bg-panel px-2 py-1 text-xs text-red-400 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-panel";

// Fixed, simple choices rather than a general arbitrary-partition-group or
// arbitrary-delay UI — clear enough to demonstrate the concept without
// building configuration UI nothing currently needs.
const REORDER_DELAY_TICKS = 3;

export function FaultInjectionMenu() {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectedMessageId = useUiStore((state) => state.selectedMessageId);
  const moduleId = useSimulationStore((state) => state.moduleId);
  const dispatch = useSimulationStore((state) => state.dispatch);

  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;
  const canPartition = (definition?.nodeIds.length ?? 0) >= 2;

  function partition() {
    if (!definition) return;
    const [first, ...rest] = definition.nodeIds;
    dispatch({ type: "PARTITION_NETWORK", groups: [[first], rest] });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      <button
        type="button"
        disabled={!selectedMessageId}
        onClick={() =>
          selectedMessageId &&
          dispatch({
            type: "REORDER_MESSAGE",
            messageId: selectedMessageId,
            delayTicks: REORDER_DELAY_TICKS,
          })
        }
        className={FAULT_BUTTON_CLASS}
      >
        <Shuffle size={14} />
        Reorder (+{REORDER_DELAY_TICKS} ticks)
      </button>

      <button
        type="button"
        disabled={!selectedMessageId}
        onClick={() =>
          selectedMessageId && dispatch({ type: "DUPLICATE_MESSAGE", messageId: selectedMessageId })
        }
        className={FAULT_BUTTON_CLASS}
      >
        <Copy size={14} />
        Duplicate
      </button>

      <button type="button" disabled={!canPartition} onClick={partition} className={FAULT_BUTTON_CLASS}>
        <Waypoints size={14} />
        Partition
      </button>

      <button
        type="button"
        onClick={() => dispatch({ type: "HEAL_PARTITION" })}
        className={FAULT_BUTTON_CLASS}
      >
        <Waypoints size={14} />
        Heal
      </button>
    </div>
  );
}

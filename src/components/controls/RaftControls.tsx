"use client";

import { useState } from "react";
import { FilePlus, Vote } from "lucide-react";

import { useNodeRole } from "@/hooks/useNodeRole";
import { useSimulationStore } from "@/store/simulationStore";
import { useUiStore } from "@/store/uiStore";

const BUTTON_CLASS =
  "flex items-center gap-1.5 rounded border border-sky-500/40 bg-bg-panel px-2 py-1 text-xs text-sky-400 hover:bg-sky-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-panel";

/**
 * Temporary trigger, same precedent as ElectionControls (Milestone 15) and
 * networking's original "Send Ping" button — no guided content exists for
 * this module yet (that's Milestone 24). Start Election is the one manual
 * bootstrap command this module ever needs (everything after is automatic,
 * per docs/12-raft-module-design.md).
 *
 * Submit Entry is disabled outright (not just left to silently no-op) when
 * the selection isn't currently the leader — found during the Milestone 25
 * polish pass: the reducer already rejected this case, but a learner
 * clicking it on a follower got no feedback at all, indistinguishable from
 * a broken button. Same reasoning applies to Start Election on an
 * already-leader node: clicking it "just to be sure" would silently demote
 * the current leader and start a real new candidacy, which is correct
 * protocol behavior but a confusing thing to trigger by accident.
 */
export function RaftControls() {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const dispatch = useSimulationStore((state) => state.dispatch);
  const events = useSimulationStore((state) => state.events);
  const viewTick = useSimulationStore((state) => state.viewTick);
  const [nextEntryNumber, setNextEntryNumber] = useState(1);

  const role = useNodeRole(events, selectedNodeId, viewTick);
  const isLeader = role === "leader";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!selectedNodeId || isLeader}
          onClick={() => selectedNodeId && dispatch({ type: "START_ELECTION", nodeId: selectedNodeId })}
          className={BUTTON_CLASS}
        >
          <Vote size={14} />
          Start Election{selectedNodeId ? ` (node ${selectedNodeId})` : ""}
        </button>

        <button
          type="button"
          disabled={!selectedNodeId || !isLeader}
          onClick={() => {
            if (!selectedNodeId) return;
            dispatch({ type: "SUBMIT_ENTRY", nodeId: selectedNodeId, value: `entry-${nextEntryNumber}` });
            setNextEntryNumber((n) => n + 1);
          }}
          className={BUTTON_CLASS}
        >
          <FilePlus size={14} />
          Submit Entry{selectedNodeId ? ` (to node ${selectedNodeId})` : ""}
        </button>
      </div>
      {selectedNodeId && !isLeader && (
        <p className="text-xs text-text-muted">
          Select the current leader (crown icon) to submit an entry.
        </p>
      )}
    </div>
  );
}

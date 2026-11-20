"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { useSimulationStore } from "@/store/simulationStore";

const MODE_BUTTON_CLASS =
  "rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40";
const WRITE_BUTTON_CLASS =
  "flex items-center gap-1.5 rounded border border-sky-500/40 bg-bg-panel px-2 py-1 text-xs text-sky-400 hover:bg-sky-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-panel";
const INPUT_CLASS =
  "w-20 rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary";

/**
 * Temporary trigger, same precedent as ElectionControls/RaftControls — no
 * guided content exists for this module yet (that's Milestone 32). Writes
 * always target the leader directly (id "leader", fixed by this module's
 * own registry entry) — unlike Election/Raft's controls, there's no
 * node-selection step, since a write only ever has one possible target.
 */
export function ReplicationControls() {
  const dispatch = useSimulationStore((state) => state.dispatch);
  const [key, setKey] = useState("x");
  const [value, setValue] = useState("1");
  // The engine's own ReplicationState.mode isn't mirrored into the store
  // (only the generic event log/tick are) — this component is the only
  // thing that ever changes it, so local state tracks it exactly.
  const [currentMode, setCurrentMode] = useState<"sync" | "async">("async");

  function setModeAndDispatch(nextMode: "sync" | "async") {
    setCurrentMode(nextMode);
    dispatch({ type: "SET_REPLICATION_MODE", mode: nextMode });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Mode:</span>
        <button
          type="button"
          aria-pressed={currentMode === "async"}
          onClick={() => setModeAndDispatch("async")}
          className={`${MODE_BUTTON_CLASS} ${
            currentMode === "async"
              ? "border-sky-500 bg-sky-950 text-sky-400"
              : "border-border-subtle bg-bg-panel text-text-muted hover:bg-bg-canvas"
          }`}
        >
          Async
        </button>
        <button
          type="button"
          aria-pressed={currentMode === "sync"}
          onClick={() => setModeAndDispatch("sync")}
          className={`${MODE_BUTTON_CLASS} ${
            currentMode === "sync"
              ? "border-sky-500 bg-sky-950 text-sky-400"
              : "border-border-subtle bg-bg-panel text-text-muted hover:bg-bg-canvas"
          }`}
        >
          Sync
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="replication-write-key">
          Key
        </label>
        <input
          id="replication-write-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key"
          className={INPUT_CLASS}
        />
        <label className="sr-only" htmlFor="replication-write-value">
          Value
        </label>
        <input
          id="replication-write-value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className={INPUT_CLASS}
        />
        <button
          type="button"
          disabled={!key}
          onClick={() => dispatch({ type: "WRITE", nodeId: "leader", key, value })}
          className={WRITE_BUTTON_CLASS}
        >
          <Send size={14} />
          Write
        </button>
      </div>
    </div>
  );
}

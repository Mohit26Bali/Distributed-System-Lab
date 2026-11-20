"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { useSimulationStore } from "@/store/simulationStore";

const NODE_IDS = ["leader", "f1", "f2", "f3"];

const TOGGLE_BUTTON_CLASS =
  "rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40";
const ACTION_BUTTON_CLASS =
  "flex items-center gap-1.5 rounded border border-sky-500/40 bg-bg-panel px-2 py-1 text-xs text-sky-400 hover:bg-sky-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-panel";
const INPUT_CLASS =
  "w-20 rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary";
const SELECT_CLASS =
  "rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary";

/**
 * Reuses Replication's own Write action (a client has to be able to write
 * before it can observe staleness on a read), plus the new READ action
 * this module's whole point is built around. See
 * docs/18-consistency-module-design.md.
 */
export function ConsistencyControls() {
  const dispatch = useSimulationStore((state) => state.dispatch);
  const [key, setKey] = useState("x");
  const [value, setValue] = useState("1");
  const [readNodeId, setReadNodeId] = useState("f1");
  const [consistency, setConsistency] = useState<"eventual" | "strong">("eventual");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="consistency-write-key">
          Key
        </label>
        <input
          id="consistency-write-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key"
          className={INPUT_CLASS}
        />
        <label className="sr-only" htmlFor="consistency-write-value">
          Value
        </label>
        <input
          id="consistency-write-value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className={INPUT_CLASS}
        />
        <button
          type="button"
          disabled={!key}
          onClick={() => dispatch({ type: "WRITE", nodeId: "leader", key, value })}
          className={ACTION_BUTTON_CLASS}
        >
          <Send size={14} />
          Write
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="consistency-read-node">
          Read from node
        </label>
        <select
          id="consistency-read-node"
          value={readNodeId}
          onChange={(e) => setReadNodeId(e.target.value)}
          className={SELECT_CLASS}
        >
          {NODE_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        <span className="text-xs text-text-muted">Consistency:</span>
        <button
          type="button"
          aria-pressed={consistency === "eventual"}
          onClick={() => setConsistency("eventual")}
          className={`${TOGGLE_BUTTON_CLASS} ${
            consistency === "eventual"
              ? "border-sky-500 bg-sky-950 text-sky-400"
              : "border-border-subtle bg-bg-panel text-text-muted hover:bg-bg-canvas"
          }`}
        >
          Eventual
        </button>
        <button
          type="button"
          aria-pressed={consistency === "strong"}
          onClick={() => setConsistency("strong")}
          className={`${TOGGLE_BUTTON_CLASS} ${
            consistency === "strong"
              ? "border-sky-500 bg-sky-950 text-sky-400"
              : "border-border-subtle bg-bg-panel text-text-muted hover:bg-bg-canvas"
          }`}
        >
          Strong
        </button>

        <button
          type="button"
          disabled={!key}
          onClick={() => dispatch({ type: "READ", nodeId: readNodeId, key, consistency })}
          className={ACTION_BUTTON_CLASS}
        >
          <Send size={14} />
          Read
        </button>
      </div>
    </div>
  );
}

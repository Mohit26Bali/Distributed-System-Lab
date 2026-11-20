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

interface ToggleGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

/** Same 2-way toggle pattern ReplicationControls/ConsistencyControls use,
 * generalized to N options since both Write mode and Read consistency
 * here have three (Async/Sync/Quorum, Eventual/Strong/Quorum) rather
 * than two. */
function ToggleGroup<T extends string>({ label, options, value, onChange }: ToggleGroupProps<T>) {
  return (
    <>
      <span className="text-xs text-text-muted">{label}:</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`${TOGGLE_BUTTON_CLASS} ${
            value === option
              ? "border-sky-500 bg-sky-950 text-sky-400"
              : "border-border-subtle bg-bg-panel text-text-muted hover:bg-bg-canvas"
          }`}
        >
          {option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </>
  );
}

const WRITE_MODES = ["async", "sync", "quorum"] as const;
const READ_LEVELS = ["eventual", "strong", "quorum"] as const;

/**
 * Same Write/Read shape as ConsistencyControls, extended with a third
 * option on each toggle for the quorum mechanic added in Milestones
 * 38-39. See docs/22-quorum-module-design.md.
 */
export function QuorumControls() {
  const dispatch = useSimulationStore((state) => state.dispatch);
  const [key, setKey] = useState("x");
  const [value, setValue] = useState("1");
  const [readNodeId, setReadNodeId] = useState("f1");
  const [mode, setMode] = useState<(typeof WRITE_MODES)[number]>("async");
  const [consistency, setConsistency] = useState<(typeof READ_LEVELS)[number]>("eventual");

  function setModeAndDispatch(next: (typeof WRITE_MODES)[number]) {
    setMode(next);
    dispatch({ type: "SET_REPLICATION_MODE", mode: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup label="Mode" options={WRITE_MODES} value={mode} onChange={setModeAndDispatch} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="quorum-write-key">
          Key
        </label>
        <input
          id="quorum-write-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key"
          className={INPUT_CLASS}
        />
        <label className="sr-only" htmlFor="quorum-write-value">
          Value
        </label>
        <input
          id="quorum-write-value"
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
        <label className="sr-only" htmlFor="quorum-read-node">
          Read from node
        </label>
        <select
          id="quorum-read-node"
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

        <ToggleGroup label="Consistency" options={READ_LEVELS} value={consistency} onChange={setConsistency} />

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

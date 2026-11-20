"use client";

import { useState } from "react";
import { Search, Send } from "lucide-react";

import { deriveKvStoreForNode, formatKvEntry } from "@/hooks/useKvStore";
import { useNodeRole } from "@/hooks/useNodeRole";
import { useSimulationStore } from "@/store/simulationStore";

const NODE_IDS = ["A", "B", "C", "D", "E"];

const ACTION_BUTTON_CLASS =
  "flex items-center gap-1.5 rounded border border-sky-500/40 bg-bg-panel px-2 py-1 text-xs text-sky-400 hover:bg-sky-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-panel";
const INPUT_CLASS =
  "w-20 rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary";
const SELECT_CLASS =
  "rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary";

/**
 * PUT is a thin wrapper around the existing SUBMIT_ENTRY action (encoded
 * via formatKvEntry — no new action type). GET dispatches nothing at
 * all: it's a pure computation over deriveKvStoreForNode, displayed
 * locally, so reading never mutates anything — same "reads are
 * observational" principle Consistency/Quorum's READ already
 * established, just without a round trip since this is a synchronous
 * derivation rather than a message exchange. See
 * docs/24-distributed-database-module-design.md.
 */
export function DatabaseControls() {
  const dispatch = useSimulationStore((state) => state.dispatch);
  const events = useSimulationStore((state) => state.events);
  const viewTick = useSimulationStore((state) => state.viewTick);

  const [putNodeId, setPutNodeId] = useState("A");
  const [key, setKey] = useState("x");
  const [value, setValue] = useState("1");
  const putNodeRole = useNodeRole(events, putNodeId, viewTick);
  const putNodeIsLeader = putNodeRole === "leader";

  const [getNodeId, setGetNodeId] = useState("A");
  const [getKey, setGetKey] = useState("x");
  const [getResult, setGetResult] = useState<{ key: string; nodeId: string; value?: string } | null>(null);

  function handleGet() {
    const store = deriveKvStoreForNode(events, getNodeId, viewTick);
    setGetResult({ key: getKey, nodeId: getNodeId, value: store[getKey] });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="db-put-node">
          Put to node
        </label>
        <select id="db-put-node" value={putNodeId} onChange={(e) => setPutNodeId(e.target.value)} className={SELECT_CLASS}>
          {NODE_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="db-put-key">
          Key
        </label>
        <input id="db-put-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" className={INPUT_CLASS} />
        <label className="sr-only" htmlFor="db-put-value">
          Value
        </label>
        <input
          id="db-put-value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className={INPUT_CLASS}
        />
        <button
          type="button"
          disabled={!key || !putNodeIsLeader}
          onClick={() => dispatch({ type: "SUBMIT_ENTRY", nodeId: putNodeId, value: formatKvEntry(key, value) })}
          className={ACTION_BUTTON_CLASS}
        >
          <Send size={14} />
          PUT
        </button>
      </div>
      {!putNodeIsLeader && (
        <p className="text-xs text-text-muted">Select the current leader (crown icon) as the PUT target.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="db-get-node">
          Get from node
        </label>
        <select id="db-get-node" value={getNodeId} onChange={(e) => setGetNodeId(e.target.value)} className={SELECT_CLASS}>
          {NODE_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="db-get-key">
          Key
        </label>
        <input
          id="db-get-key"
          value={getKey}
          onChange={(e) => setGetKey(e.target.value)}
          placeholder="key"
          className={INPUT_CLASS}
        />
        <button type="button" disabled={!getKey} onClick={handleGet} className={ACTION_BUTTON_CLASS}>
          <Search size={14} />
          GET
        </button>
      </div>

      {getResult && (
        <p className="text-xs text-text-muted">
          {getResult.nodeId}.get({getResult.key}) ={" "}
          <span className="font-mono text-text-primary">
            {getResult.value === undefined ? "(not found)" : getResult.value}
          </span>
        </p>
      )}
    </div>
  );
}

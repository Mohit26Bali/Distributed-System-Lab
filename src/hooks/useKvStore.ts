import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import {
  RAFT_EVENT_TYPES,
  type LogEntryAppendedPayload,
  type LogEntryCommittedPayload,
} from "@/modules/raft/raftEvents";

/**
 * The Distributed Database capstone's encoding convention for a Raft log
 * entry's opaque `value` string: a single `key=value` pair. Not a new
 * action type — PUT is just SUBMIT_ENTRY with its value formatted this
 * way. Splits on the FIRST "=" only, so a value containing "=" is still
 * parsed correctly (only the key is assumed "=" free).
 */
export function formatKvEntry(key: string, value: string): string {
  return `${key}=${value}`;
}

export function parseKvEntry(raw: string): { key: string; value: string } | null {
  const separatorIndex = raw.indexOf("=");
  if (separatorIndex === -1) return null;
  return { key: raw.slice(0, separatorIndex), value: raw.slice(separatorIndex + 1) };
}

/**
 * A specific node's own committed key-value view, as of `tick` — derived
 * strictly from that node's own LOG_ENTRY_APPENDED and LOG_ENTRY_COMMITTED
 * events, per the invariant in docs/24-distributed-database-module-
 * design.md. Never reads a node's in-memory log/commitIndex directly,
 * even though both already exist on RaftState — the whole point is that
 * this view must be reconstructable from the event log alone, the same
 * way every other module's derived state already is.
 *
 * Two nodes can legitimately disagree: a lagging or partitioned-away
 * follower's own commit progress can sit behind the cluster's true
 * committed state, and its KV view stays frozen at whatever it last
 * knew until its own commit catches up.
 */
export function deriveKvStoreForNode(events: readonly SimEvent[], nodeId: string | null, tick: Tick): Record<string, string> {
  if (!nodeId) return {};

  // This node's own log, as of `tick` — the latest LOG_ENTRY_APPENDED
  // for each index wins, mirroring how a real AppendEntries truncates
  // any conflicting tail before appending: an earlier event for the
  // same index is superseded, never merged with a later one.
  const entriesByIndex = new Map<number, string>();
  let commitIndex = -1;

  for (const event of events) {
    if (event.tick > tick) continue;

    if (event.type === RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED) {
      const payload = event.payload as LogEntryAppendedPayload;
      if (payload.nodeId === nodeId) entriesByIndex.set(payload.index, payload.value);
    } else if (event.type === RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED) {
      const payload = event.payload as LogEntryCommittedPayload;
      if (payload.nodeId === nodeId) commitIndex = Math.max(commitIndex, payload.index);
    }
  }

  const store: Record<string, string> = {};
  for (let index = 0; index <= commitIndex; index++) {
    const raw = entriesByIndex.get(index);
    if (raw === undefined) continue; // shouldn't happen — a committed index was always appended first
    const parsed = parseKvEntry(raw);
    if (parsed) store[parsed.key] = parsed.value;
  }
  return store;
}

export function useKvStore(events: readonly SimEvent[], nodeId: string | null, tick: Tick): Record<string, string> {
  return useMemo(() => deriveKvStoreForNode(events, nodeId, tick), [events, nodeId, tick]);
}

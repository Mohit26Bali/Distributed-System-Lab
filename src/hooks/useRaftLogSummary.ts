import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import {
  RAFT_EVENT_TYPES,
  type LogEntryAppendedPayload,
  type LogEntryCommittedPayload,
} from "@/modules/raft/raftEvents";

/**
 * How many entries a specific node's own log has, as of `tick` — derived
 * from that node's own LOG_ENTRY_APPENDED events (never assumed equal to
 * any other node's, since followers can genuinely lag behind).
 */
export function deriveLogLength(events: readonly SimEvent[], nodeId: string | null, tick: Tick): number {
  if (!nodeId) return 0;

  let highestIndex = -1;
  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type !== RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED) continue;
    const payload = event.payload as LogEntryAppendedPayload;
    if (payload.nodeId === nodeId) highestIndex = Math.max(highestIndex, payload.index);
  }
  return highestIndex + 1;
}

/**
 * The highest log index confirmed committed cluster-wide as of `tick` — a
 * global fact (LOG_ENTRY_COMMITTED carries no nodeId, since committedness
 * is decided once, by the leader, not per-node). A given follower's own
 * local commitIndex can lag slightly behind this until its next
 * AppendEntries arrives; this shows the cluster's authoritative value, not
 * necessarily the exact node selected.
 */
export function deriveCommittedThroughIndex(events: readonly SimEvent[], tick: Tick): number {
  let highestIndex = -1;
  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type !== RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED) continue;
    const payload = event.payload as LogEntryCommittedPayload;
    highestIndex = Math.max(highestIndex, payload.index);
  }
  return highestIndex;
}

/**
 * A specific node's OWN local commit progress, as of `tick` — unlike
 * deriveCommittedThroughIndex's cluster-wide max, this can genuinely lag
 * (a partitioned-away follower's own commit never advances even while
 * the reachable majority's does). Added alongside the per-node
 * LOG_ENTRY_COMMITTED emission from Milestone 42, for the Distributed
 * Database capstone's per-node KV derivation.
 */
export function deriveNodeCommitIndex(events: readonly SimEvent[], nodeId: string | null, tick: Tick): number {
  if (!nodeId) return -1;

  let highestIndex = -1;
  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type !== RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED) continue;
    const payload = event.payload as LogEntryCommittedPayload;
    if (payload.nodeId === nodeId) highestIndex = Math.max(highestIndex, payload.index);
  }
  return highestIndex;
}

export function useNodeCommitIndex(events: readonly SimEvent[], nodeId: string | null, tick: Tick): number {
  return useMemo(() => deriveNodeCommitIndex(events, nodeId, tick), [events, nodeId, tick]);
}

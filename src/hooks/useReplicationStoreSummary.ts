import type { SimEvent, Tick } from "@/simulation/engine/types";
import {
  REPLICATION_EVENT_TYPES,
  type WriteAcceptedPayload,
  type WriteAcknowledgedPayload,
  type WriteReplicatedPayload,
} from "@/modules/replication/replicationEvents";

/**
 * A specific node's own view of the data as of `tick` — built from
 * WRITE_ACCEPTED (for the leader) and WRITE_REPLICATED (for followers)
 * events targeting that node specifically. Deliberately per-node, never a
 * single shared "the data," since a follower can genuinely lag behind.
 */
export function deriveNodeStore(events: readonly SimEvent[], nodeId: string | null, tick: Tick): Record<string, string> {
  if (!nodeId) return {};

  const store: Record<string, string> = {};
  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED) {
      const payload = event.payload as WriteAcceptedPayload;
      if (payload.nodeId === nodeId) store[payload.key] = payload.value;
    } else if (event.type === REPLICATION_EVENT_TYPES.WRITE_REPLICATED) {
      const payload = event.payload as WriteReplicatedPayload;
      if (payload.nodeId === nodeId) store[payload.key] = payload.value;
    }
  }
  return store;
}

/**
 * Keys with a write of the given mode accepted but not yet acknowledged,
 * as of `tick` — the inspector's answer to "why is this write stuck,"
 * without needing a per-follower awaiting/ackedBy list (which isn't
 * reconstructable from the event log alone; WRITE_ACKNOWLEDGED only
 * fires once, on completion, not per-follower — a deliberate
 * simplification, see docs/16-replication-module-design.md).
 */
function derivePendingKeysByMode(events: readonly SimEvent[], tick: Tick, mode: "sync" | "quorum"): string[] {
  const pending = new Set<string>();
  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED) {
      const payload = event.payload as WriteAcceptedPayload;
      if (payload.mode === mode) pending.add(payload.key);
    } else if (event.type === REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED) {
      const payload = event.payload as WriteAcknowledgedPayload;
      pending.delete(payload.key);
    }
  }
  return [...pending];
}

export function derivePendingSyncKeys(events: readonly SimEvent[], tick: Tick): string[] {
  return derivePendingKeysByMode(events, tick, "sync");
}

export function derivePendingQuorumKeys(events: readonly SimEvent[], tick: Tick): string[] {
  return derivePendingKeysByMode(events, tick, "quorum");
}

/**
 * A specific node's own view of each key's write version, as of `tick` —
 * the Quorum module's answer to "which of these replicas is actually
 * newer," mirroring deriveNodeStore exactly but for the version counter
 * instead of the value itself.
 */
export function deriveNodeStoreVersions(
  events: readonly SimEvent[],
  nodeId: string | null,
  tick: Tick,
): Record<string, number> {
  if (!nodeId) return {};

  const versions: Record<string, number> = {};
  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED) {
      const payload = event.payload as WriteAcceptedPayload;
      if (payload.nodeId === nodeId) versions[payload.key] = payload.version;
    } else if (event.type === REPLICATION_EVENT_TYPES.WRITE_REPLICATED) {
      const payload = event.payload as WriteReplicatedPayload;
      if (payload.nodeId === nodeId) versions[payload.key] = payload.version;
    }
  }
  return versions;
}

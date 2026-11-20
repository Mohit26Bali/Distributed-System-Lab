import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import {
  REPLICATION_EVENT_TYPES,
  type ConsistencyLevel,
  type ReadRequestedPayload,
  type ReadServedPayload,
} from "@/modules/replication/replicationEvents";

export interface LastReadServed {
  key: string;
  value?: string;
  found: boolean;
  consistency: ConsistencyLevel;
  servedByNodeId: string;
  /** Ticks between READ_REQUESTED and READ_SERVED for this read — 0 for an
   * eventual read (same-tick), the full round trip for a strong one. */
  roundTripTicks: number;
}

/**
 * The most recent read a given node has been served, as of `tick` —
 * derived purely from READ_REQUESTED/READ_SERVED events, per the
 * project's events-only derivation convention. Pairs each READ_SERVED
 * with the most recent prior READ_REQUESTED from the same node to compute
 * round-trip cost; since the UI only ever drives one read at a time per
 * node, this simple "most recent" pairing is sufficient — it does not
 * attempt to track multiple concurrent outstanding reads.
 */
export function deriveLastReadServed(
  events: readonly SimEvent[],
  nodeId: string | null,
  tick: Tick,
): LastReadServed | null {
  if (!nodeId) return null;

  let pendingRequestTick: Tick | null = null;
  let lastServedTick: Tick | null = null;
  let lastServedPayload: ReadServedPayload | null = null;
  let lastServedRequestTick: Tick | null = null;

  for (const event of events) {
    if (event.tick > tick) continue;

    if (event.type === REPLICATION_EVENT_TYPES.READ_REQUESTED) {
      const payload = event.payload as ReadRequestedPayload;
      if (payload.nodeId === nodeId) pendingRequestTick = event.tick;
    } else if (event.type === REPLICATION_EVENT_TYPES.READ_SERVED) {
      const payload = event.payload as ReadServedPayload;
      if (payload.nodeId === nodeId) {
        lastServedTick = event.tick;
        lastServedPayload = payload;
        lastServedRequestTick = pendingRequestTick;
      }
    }
  }

  if (!lastServedPayload || lastServedTick === null) return null;

  return {
    key: lastServedPayload.key,
    value: lastServedPayload.value,
    found: lastServedPayload.found,
    consistency: lastServedPayload.consistency,
    servedByNodeId: lastServedPayload.servedByNodeId,
    roundTripTicks: lastServedRequestTick !== null ? lastServedTick - lastServedRequestTick : 0,
  };
}

export function useLastReadServed(
  events: readonly SimEvent[],
  nodeId: string | null,
  tick: Tick,
): LastReadServed | null {
  return useMemo(() => deriveLastReadServed(events, nodeId, tick), [events, nodeId, tick]);
}

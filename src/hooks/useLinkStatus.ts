import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES, type PartitionStartedPayload } from "@/simulation/events/networkEvents";

/**
 * Whether nodeA/nodeB are on opposite sides of a partition as of `tick`,
 * derived purely from PARTITION_STARTED/PARTITION_HEALED events — the
 * canvas never reads NetworkModel's live partition state directly, same
 * "everything visible derives from events" discipline as node/message
 * status.
 */
export function deriveIsPartitioned(
  events: readonly SimEvent[],
  nodeA: string,
  nodeB: string,
  tick: Tick,
): boolean {
  let groups: string[][] | null = null;

  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type === NETWORK_EVENT_TYPES.PARTITION_STARTED) {
      groups = (event.payload as PartitionStartedPayload).groups;
    } else if (event.type === NETWORK_EVENT_TYPES.PARTITION_HEALED) {
      groups = null;
    }
  }

  if (!groups) return false;
  const groupOf = (id: string) => groups!.findIndex((group) => group.includes(id));
  return groupOf(nodeA) !== groupOf(nodeB);
}

export function useLinkStatus(
  events: readonly SimEvent[],
  nodeA: string,
  nodeB: string,
  tick: Tick,
): { partitioned: boolean } {
  return useMemo(
    () => ({ partitioned: deriveIsPartitioned(events, nodeA, nodeB, tick) }),
    [events, nodeA, nodeB, tick],
  );
}

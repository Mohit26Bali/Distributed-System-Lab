import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import { NODE_EVENT_TYPES, type NodeCrashedPayload } from "@/simulation/events/nodeEvents";

export type NodeStatus = "alive" | "crashed";

/**
 * A node's status as of `tick`, derived purely from the event log — no
 * recovery event exists yet (that's a future milestone's concern), so the
 * first NODE_CRASHED at or before `tick` is terminal.
 */
export function deriveNodeStatus(
  events: readonly SimEvent[],
  nodeId: string | null,
  tick: Tick,
): NodeStatus {
  if (!nodeId) return "alive";

  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type !== NODE_EVENT_TYPES.NODE_CRASHED) continue;
    if ((event.payload as NodeCrashedPayload).nodeId === nodeId) return "crashed";
  }

  return "alive";
}

export function useNodeStatus(
  events: readonly SimEvent[],
  nodeId: string | null,
  tick: Tick,
): NodeStatus {
  return useMemo(() => deriveNodeStatus(events, nodeId, tick), [events, nodeId, tick]);
}

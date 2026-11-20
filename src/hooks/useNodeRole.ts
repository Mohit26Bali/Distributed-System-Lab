import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import {
  ELECTION_EVENT_TYPES,
  type ElectionRole,
  type NodeRoleChangedPayload,
} from "@/modules/election/electionEvents";

/**
 * A node's election role as of `tick`, derived purely from the event log
 * (mirrors useNodeStatus.ts exactly). Modules with no NODE_ROLE_CHANGED
 * events (e.g. networking) simply never produce anything but "follower",
 * so this is inert there — see docs/10-election-module-design.md.
 */
export function deriveNodeRole(events: readonly SimEvent[], nodeId: string | null, tick: Tick): ElectionRole {
  if (!nodeId) return "follower";

  let role: ElectionRole = "follower";
  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type !== ELECTION_EVENT_TYPES.NODE_ROLE_CHANGED) continue;
    const payload = event.payload as NodeRoleChangedPayload;
    if (payload.nodeId === nodeId) role = payload.role;
  }
  return role;
}

export function useNodeRole(events: readonly SimEvent[], nodeId: string | null, tick: Tick): ElectionRole {
  return useMemo(() => deriveNodeRole(events, nodeId, tick), [events, nodeId, tick]);
}

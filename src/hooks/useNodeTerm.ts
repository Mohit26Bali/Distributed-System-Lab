import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import { RAFT_EVENT_TYPES, type TermChangedPayload } from "@/modules/raft/raftEvents";

/**
 * A node's current Raft term as of `tick`, derived purely from the event
 * log (mirrors useNodeStatus.ts/useNodeRole.ts exactly). Modules with no
 * TERM_CHANGED events (networking, election) simply never produce a term
 * above 0, so any term badge driven by this stays inert there.
 */
export function deriveNodeTerm(events: readonly SimEvent[], nodeId: string | null, tick: Tick): number {
  if (!nodeId) return 0;

  let term = 0;
  for (const event of events) {
    if (event.tick > tick) continue;
    if (event.type !== RAFT_EVENT_TYPES.TERM_CHANGED) continue;
    const payload = event.payload as TermChangedPayload;
    if (payload.nodeId === nodeId) term = payload.term;
  }
  return term;
}

export function useNodeTerm(events: readonly SimEvent[], nodeId: string | null, tick: Tick): number {
  return useMemo(() => deriveNodeTerm(events, nodeId, tick), [events, nodeId, tick]);
}

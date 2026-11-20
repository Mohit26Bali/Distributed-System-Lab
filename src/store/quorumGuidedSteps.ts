import type { SimEvent } from "@/simulation/engine/types";
import { NODE_EVENT_TYPES, type NodeCrashedPayload } from "@/simulation/events/nodeEvents";
import {
  REPLICATION_EVENT_TYPES,
  type ReadRequestedPayload,
  type ReadServedPayload,
  type WriteAcceptedPayload,
} from "@/modules/replication/replicationEvents";
import type { GuidedStepDefinition } from "./guidedSteps";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function hasWriteAcceptedWithMode(events: readonly SimEvent[], mode: "sync" | "async" | "quorum"): boolean {
  return events.some(
    (event) =>
      event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED && (event.payload as WriteAcceptedPayload).mode === mode,
  );
}

function countDistinctCrashedNodes(events: readonly SimEvent[]): number {
  const crashed = new Set<string>();
  for (const event of events) {
    if (event.type === NODE_EVENT_TYPES.NODE_CRASHED) crashed.add((event.payload as NodeCrashedPayload).nodeId);
  }
  return crashed.size;
}

function hasReadServed(events: readonly SimEvent[], predicate: (payload: ReadServedPayload) => boolean): boolean {
  return events.some(
    (event) => event.type === REPLICATION_EVENT_TYPES.READ_SERVED && predicate(event.payload as ReadServedPayload),
  );
}

function hasReadRequested(events: readonly SimEvent[], predicate: (payload: ReadRequestedPayload) => boolean): boolean {
  return events.some(
    (event) =>
      event.type === REPLICATION_EVENT_TYPES.READ_REQUESTED && predicate(event.payload as ReadRequestedPayload),
  );
}

// This 4-node cluster's majority is 3 — the concrete numbers the roadmap's
// "kill nodes until it stops working" success criterion (docs/00-vision.md)
// finally lands on directly: 1 dead node still leaves a majority; 2 dead
// nodes never can.
export const QUORUM_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "quorum-write-survives-one-dead-follower",
    instruction: "Switch Mode to Quorum. Kill one follower, then submit a write.",
    observation:
      "WRITE_ACKNOWLEDGED still fired — the leader plus the two remaining followers is 3 of 4, a majority, even with one node down.",
    isSatisfied: (events) =>
      hasWriteAcceptedWithMode(events, "quorum") &&
      hasEventType(events, REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED) &&
      countDistinctCrashedNodes(events) >= 1,
  },
  {
    id: "quorum-write-breaks-with-two-dead",
    instruction: "Kill a second follower, then submit another write.",
    observation:
      "Check the inspector: this write never acknowledges. Only 2 of 4 nodes are reachable now, and majority needs 3 — the exact node count where quorum stops working, live.",
    isSatisfied: (events) => hasWriteAcceptedWithMode(events, "quorum") && countDistinctCrashedNodes(events) >= 2,
  },
  {
    id: "quorum-read-reconciles-versions",
    instruction:
      "With both followers still dead from before, that's expected to stay broken — instead, undo by starting fresh: write a key twice in a row (two different values), then issue a Quorum read from any alive follower.",
    isSatisfied: (events) => {
      const accepted = events.filter((event) => event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED);
      const distinctValues = new Set(accepted.map((event) => (event.payload as WriteAcceptedPayload).value));
      return distinctValues.size >= 2 && hasReadServed(events, (p) => p.consistency === "quorum" && p.found === true);
    },
    observation:
      "The version the inspector shows matches your SECOND write, not the first — a quorum read always resolves to the highest version among however many replicas answered, even if a stale one was counted too.",
  },
  {
    id: "quorum-read-breaks-with-two-dead",
    instruction: "Kill a second follower again, then issue a Quorum read from the one still alive.",
    observation:
      "This hangs too, for the same reason the write did: only 2 of 4 nodes can ever answer, and a quorum read needs the same majority a quorum write does.",
    isSatisfied: (events) =>
      hasReadRequested(events, (p) => p.consistency === "quorum") && countDistinctCrashedNodes(events) >= 2,
  },
];

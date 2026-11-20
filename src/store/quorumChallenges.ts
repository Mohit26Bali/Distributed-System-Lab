import type { SimEvent } from "@/simulation/engine/types";
import { NODE_EVENT_TYPES, type NodeCrashedPayload } from "@/simulation/events/nodeEvents";
import {
  REPLICATION_EVENT_TYPES,
  type ReadServedPayload,
  type WriteAcceptedPayload,
} from "@/modules/replication/replicationEvents";
import type { ChallengeDefinition } from "./challenges";

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

export const QUORUM_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "quorum-write-survives-a-dead-follower",
    title: "Challenge: Majority Is Enough",
    prompt: "In Quorum mode, get a write to acknowledge with exactly one follower dead.",
    isComplete: (events) =>
      hasWriteAcceptedWithMode(events, "quorum") &&
      hasEventType(events, REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED) &&
      countDistinctCrashedNodes(events) >= 1,
  },
  {
    id: "break-quorum-with-two-dead-followers",
    title: "Challenge: Find Where It Breaks",
    prompt: "In Quorum mode, kill a second follower and submit a write that never acknowledges — the exact node count where majority becomes unreachable.",
    isComplete: (events) => hasWriteAcceptedWithMode(events, "quorum") && countDistinctCrashedNodes(events) >= 2,
  },
  {
    id: "quorum-read-reconciles-a-stale-replica",
    title: "Challenge: Trust the Newer Version",
    prompt:
      "Write the same key twice with different values, then get a Quorum read from a follower to resolve correctly to the newer one — even if a stale replica's answer was one of the ones counted toward the majority.",
    isComplete: (events) => {
      const accepted = events.filter((event) => event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED);
      const distinctValues = new Set(accepted.map((event) => (event.payload as WriteAcceptedPayload).value));
      if (distinctValues.size < 2) return false;

      const latestAccepted = accepted[accepted.length - 1];
      const latestValue = (latestAccepted?.payload as WriteAcceptedPayload | undefined)?.value;
      return events.some(
        (event) =>
          event.type === REPLICATION_EVENT_TYPES.READ_SERVED &&
          (event.payload as ReadServedPayload).consistency === "quorum" &&
          (event.payload as ReadServedPayload).found === true &&
          (event.payload as ReadServedPayload).value === latestValue,
      );
    },
  },
];

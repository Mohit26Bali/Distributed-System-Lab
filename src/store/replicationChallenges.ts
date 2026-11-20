import type { SimEvent } from "@/simulation/engine/types";
import { NODE_EVENT_TYPES } from "@/simulation/events/nodeEvents";
import { REPLICATION_EVENT_TYPES, type WriteAcceptedPayload } from "@/modules/replication/replicationEvents";
import type { ChallengeDefinition } from "./challenges";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function hasWriteAcceptedWithMode(events: readonly SimEvent[], mode: "sync" | "async"): boolean {
  return events.some(
    (event) => event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED && (event.payload as WriteAcceptedPayload).mode === mode,
  );
}

export const REPLICATION_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "acknowledge-before-everyone-has-it",
    title: "Challenge: Fast but Risky",
    prompt: "In async mode, cause a write to acknowledge before every follower has replicated it.",
    isComplete: (events) => hasWriteAcceptedWithMode(events, "async") && hasEventType(events, REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED),
  },
  {
    id: "stick-a-sync-write-forever",
    title: "Challenge: Stuck Forever",
    prompt:
      "In sync mode, submit a write and kill a follower before it can reply — causing that write to become permanently stuck (verify via the inspector's pending sync writes list).",
    isComplete: (events) => hasWriteAcceptedWithMode(events, "sync") && hasEventType(events, NODE_EVENT_TYPES.NODE_CRASHED),
  },
  {
    id: "same-write-same-fault-different-outcome",
    title: "Challenge: Same Write, Same Fault, Different Outcome",
    prompt:
      "Cause the exact same write, against the exact same fault, to resolve differently depending only on the mode — one acknowledges, the other doesn't.",
    isComplete: (events) => hasWriteAcceptedWithMode(events, "async") && hasWriteAcceptedWithMode(events, "sync") && hasEventType(events, NODE_EVENT_TYPES.NODE_CRASHED),
  },
];

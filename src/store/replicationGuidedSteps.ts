import type { SimEvent } from "@/simulation/engine/types";
import { NODE_EVENT_TYPES } from "@/simulation/events/nodeEvents";
import { REPLICATION_EVENT_TYPES, type WriteAcceptedPayload } from "@/modules/replication/replicationEvents";
import type { GuidedStepDefinition } from "./guidedSteps";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function hasWriteAcceptedWithMode(events: readonly SimEvent[], mode: "sync" | "async"): boolean {
  return events.some(
    (event) => event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED && (event.payload as WriteAcceptedPayload).mode === mode,
  );
}

// A sync write only ever waits for followers that were ALIVE AT WRITE TIME
// (docs/16-replication-module-design.md) — killing a follower BEFORE
// submitting a write simply excludes it, and the write still resolves
// fine. To genuinely demonstrate a permanently-stuck write, the kill has
// to happen AFTER the write is submitted but BEFORE that follower acks —
// order matters, and steps 4 below are written to require it explicitly.
export const REPLICATION_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "async-write",
    instruction: "Leave the mode on Async (the default), then submit a write from the leader.",
    observation:
      "WRITE_ACKNOWLEDGED fired the instant the leader accepted it — before any follower had necessarily received anything yet. Check the timeline: the acknowledgment committed before the replicate packets even arrived.",
    isSatisfied: (events) => hasEventType(events, REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED),
  },
  {
    id: "sync-write",
    instruction: "Switch to Sync mode, then submit a different write.",
    observation:
      "This time WRITE_ACKNOWLEDGED waited until every follower's replicate-ack came back — durability, at the cost of a longer round trip.",
    isSatisfied: (events) => hasWriteAcceptedWithMode(events, "sync") && hasEventType(events, REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED),
  },
  {
    id: "async-write-survives-dead-follower",
    instruction: "Switch back to Async. Submit a write, then immediately kill a follower.",
    observation:
      "The write had already acknowledged before you even clicked Kill Node — async mode doesn't care what happens to followers after the fact. That follower's copy is just gone now, forever (no recovery mechanic).",
    isSatisfied: (events) =>
      hasWriteAcceptedWithMode(events, "async") &&
      hasEventType(events, REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED) &&
      hasEventType(events, NODE_EVENT_TYPES.NODE_CRASHED),
  },
  {
    id: "sync-write-gets-stuck",
    instruction:
      "Switch to Sync. Submit a write, then immediately select one of the still-alive followers and click Kill Node before it can reply.",
    observation:
      "Check the inspector's pending sync writes list on the leader: that write is stuck there permanently. There's no timeout and no majority escape hatch yet — only that follower coming back would unstick it, and it can't.",
    isSatisfied: (events) => hasWriteAcceptedWithMode(events, "sync") && hasEventType(events, NODE_EVENT_TYPES.NODE_CRASHED),
  },
  {
    id: "compare-side-by-side",
    instruction:
      "With one follower left, submit one more write in Async mode, then switch to Sync and submit again with the same follower still alive — compare which one acknowledges and which doesn't.",
    observation:
      "Same write, same cluster state, only the mode differs — and the outcome is completely different. That's the whole lesson of this module.",
    isSatisfied: (events) => hasWriteAcceptedWithMode(events, "async") && hasWriteAcceptedWithMode(events, "sync"),
  },
];

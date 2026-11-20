import type { SimEvent } from "@/simulation/engine/types";
import {
  REPLICATION_EVENT_TYPES,
  type ReadServedPayload,
  type WriteAcceptedPayload,
} from "@/modules/replication/replicationEvents";
import type { GuidedStepDefinition } from "./guidedSteps";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function hasReadServed(
  events: readonly SimEvent[],
  predicate: (payload: ReadServedPayload) => boolean,
): boolean {
  return events.some(
    (event) => event.type === REPLICATION_EVENT_TYPES.READ_SERVED && predicate(event.payload as ReadServedPayload),
  );
}

// Order matters: step 2 depends on reading a follower's local store BEFORE
// replication has delivered, so it must happen right after the write, not
// after advancing the simulation — the instruction text says so explicitly.
export const CONSISTENCY_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "not-found-read",
    instruction: "Pick any follower, leave consistency on Eventual, and read a key nobody has written yet.",
    observation:
      'READ_SERVED fired with found: false — an empty store answers honestly that it has nothing, rather than errors or waits.',
    isSatisfied: (events) => hasReadServed(events, (p) => p.found === false),
  },
  {
    id: "eventual-read-staleness",
    instruction:
      "Submit a write from the leader, then immediately (before stepping the simulation forward) switch to a different follower and read that same key with Eventual selected.",
    observation:
      "The write already committed on the leader, but the follower answered as if it never happened — replication hasn't had time to arrive yet, and an eventual read never waits for it.",
    isSatisfied: (events) =>
      hasEventType(events, REPLICATION_EVENT_TYPES.WRITE_ACCEPTED) &&
      hasReadServed(events, (p) => p.consistency === "eventual" && p.found === false),
  },
  {
    id: "strong-read-round-trip",
    instruction: "Read that exact same key from that same follower again, this time with Strong selected.",
    observation:
      "This one took real ticks — check the inspector's round-trip count — because the follower had to ask the leader and wait. But it's never wrong: a strong read is always the leader's current answer.",
    isSatisfied: (events) => hasReadServed(events, (p) => p.consistency === "strong" && p.found === true),
  },
  {
    id: "read-your-writes-violation",
    instruction:
      "Submit one more write, then immediately read that key from a follower twice: once Eventual, once Strong. Compare the two answers.",
    observation:
      "You just wrote this value yourself, but the eventual read may show the old value or nothing at all — a real violation of \"read your own writes.\" The strong read never has this problem, by construction.",
    isSatisfied: (events) => {
      const write = events.find((event) => event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED);
      if (!write) return false;
      const key = (write.payload as WriteAcceptedPayload).key;
      const hasEventual = hasReadServed(events, (p) => p.consistency === "eventual" && p.key === key);
      const hasStrong = hasReadServed(events, (p) => p.consistency === "strong" && p.key === key && p.found === true);
      return hasEventual && hasStrong;
    },
  },
];

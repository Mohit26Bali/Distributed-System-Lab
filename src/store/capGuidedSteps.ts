import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES, type MessageDroppedPayload } from "@/simulation/events/networkEvents";
import { REPLICATION_EVENT_TYPES, type ReadServedPayload } from "@/modules/replication/replicationEvents";
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

// Order matters: steps 4-5 depend on the partition from step 1 still
// being in effect when the strong read in step 3 was issued — the whole
// point is that healing the partition (step 4) does NOT retroactively
// rescue a request that already failed while it was up.
export const CAP_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "partition-the-leader",
    instruction: "Click Partition in the fault menu — this isolates the leader from every follower.",
    observation:
      "PARTITION_STARTED committed. The leader can no longer reach, or be reached by, any follower — and nothing on-screen announces it beyond this one event.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.PARTITION_STARTED),
  },
  {
    id: "availability-choice",
    instruction: "Pick a cut-off follower, leave consistency on Eventual, and read any key.",
    observation:
      "It answered immediately. That's the Availability choice: the system stayed responsive, at the cost of the answer being only whatever that follower knew before the partition began.",
    isSatisfied: (events) => hasReadServed(events, (p) => p.consistency === "eventual"),
  },
  {
    id: "consistency-choice",
    instruction:
      "Read the exact same key from the same follower again with Strong selected, then step the simulation forward until something happens.",
    observation:
      'The forward message to the leader was dropped, reason "partitioned" — nothing ever comes back. That\'s the Consistency choice: the follower would rather answer nothing than answer something it can\'t verify.',
    isSatisfied: (events) =>
      events.some(
        (event) =>
          event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED &&
          (event.payload as MessageDroppedPayload).reason === "partitioned",
      ),
  },
  {
    id: "heal-without-retry",
    instruction: "Heal the partition — but don't submit any new read yet.",
    observation:
      "PARTITION_HEALED committed, and the strong read from the previous step still hasn't resolved. Nothing retries automatically; a dropped message is simply gone.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.PARTITION_HEALED),
  },
  {
    id: "fresh-strong-read-after-heal",
    instruction: "Now issue a brand-new Strong read of the same key from the same follower.",
    observation:
      "This one resolves normally — the path to the leader is open again, so a fresh request behaves like any other strong read always has.",
    isSatisfied: (events) => hasReadServed(events, (p) => p.consistency === "strong" && p.found === true),
  },
];

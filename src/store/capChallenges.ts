import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES, type MessageDroppedPayload } from "@/simulation/events/networkEvents";
import {
  REPLICATION_EVENT_TYPES,
  type ReadServedPayload,
  type WriteAcceptedPayload,
} from "@/modules/replication/replicationEvents";
import type { ChallengeDefinition } from "./challenges";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

export const CAP_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "reproduce-availability",
    title: "Challenge: Choose Availability",
    prompt:
      "Partition the leader away, then get an Eventual read from a cut-off follower to answer anyway — proving the system stayed available at the cost of a possibly-stale answer.",
    isComplete: (events) =>
      hasEventType(events, NETWORK_EVENT_TYPES.PARTITION_STARTED) &&
      events.some(
        (event) =>
          event.type === REPLICATION_EVENT_TYPES.READ_SERVED &&
          (event.payload as ReadServedPayload).consistency === "eventual",
      ),
  },
  {
    id: "reproduce-consistency",
    title: "Challenge: Choose Consistency",
    prompt:
      "Partition the leader away, then get a Strong read from a cut-off follower to have its forward message dropped as \"partitioned\" — proving the system refused to answer rather than risk answering wrong.",
    isComplete: (events) =>
      hasEventType(events, NETWORK_EVENT_TYPES.PARTITION_STARTED) &&
      events.some(
        (event) =>
          event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED &&
          (event.payload as MessageDroppedPayload).reason === "partitioned",
      ),
  },
  {
    id: "verify-no-split-brain",
    title: "Challenge: No Split-Brain, By Construction",
    prompt:
      "Submit at least one write while the leader is partitioned away, then confirm in the event log that every WRITE_ACCEPTED still names the same single node — this cluster can't split-brain no matter what you do to the network, because only one node can ever accept a write.",
    isComplete: (events) => {
      const writers = new Set(
        events
          .filter((event) => event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED)
          .map((event) => (event.payload as WriteAcceptedPayload).nodeId),
      );
      return writers.size > 0 && [...writers].every((id) => id === "leader");
    },
  },
];

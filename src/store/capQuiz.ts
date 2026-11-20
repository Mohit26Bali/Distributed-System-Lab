import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import {
  REPLICATION_EVENT_TYPES,
  type ReadRequestedPayload,
  type ReadServedPayload,
} from "@/modules/replication/replicationEvents";
import type { PredictiveQuizDefinition } from "./quiz";

export const CAP_QUIZZES: PredictiveQuizDefinition[] = [
  {
    id: "strong-read-during-partition-never-resolves",
    question:
      "Pick a guess, then partition the leader away, issue a Strong read from a cut-off follower, and step forward. Then, to confirm real time has passed, issue an Eventual read of any other key. Does the original strong read ever resolve while the partition is still up?",
    options: [
      { id: "yes", label: "Yes — it retries until it gets through" },
      { id: "no", label: "No — it hangs until the partition heals and a fresh request is made" },
    ],
    resolveOutcome: (events) => {
      // Same bounded-resolution trick as Consistency's own strong-read
      // quiz (Milestone 35): there's no timeout in this engine, so "will
      // never resolve" needs a second, unrelated terminal event to prove
      // time actually passed.
      let partitioned = false;
      let strongRequested = false;

      for (const event of events) {
        if (event.type === NETWORK_EVENT_TYPES.PARTITION_STARTED) partitioned = true;
        if (!partitioned) continue;

        if (event.type === REPLICATION_EVENT_TYPES.READ_REQUESTED) {
          const payload = event.payload as ReadRequestedPayload;
          if (payload.consistency === "strong") strongRequested = true;
        }
        if (!strongRequested) continue;

        if (event.type !== REPLICATION_EVENT_TYPES.READ_SERVED) continue;
        const payload = event.payload as ReadServedPayload;
        if (payload.consistency === "strong") return "yes";
        if (payload.consistency === "eventual") return "no";
      }
      return undefined;
    },
  },
];

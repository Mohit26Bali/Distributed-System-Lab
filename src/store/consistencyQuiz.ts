import {
  REPLICATION_EVENT_TYPES,
  type ReadRequestedPayload,
  type ReadServedPayload,
  type WriteAcceptedPayload,
} from "@/modules/replication/replicationEvents";
import type { PredictiveQuizDefinition } from "./quiz";

export const CONSISTENCY_QUIZZES: PredictiveQuizDefinition[] = [
  {
    id: "eventual-read-same-tick-as-write",
    question:
      "Pick a guess, then submit a write on the leader and, in the very same tick — before stepping the simulation forward — issue an Eventual read of that same key from a follower. Does the read see the new value?",
    options: [
      { id: "yes", label: "Yes — the write is already there" },
      { id: "no", label: "No — the follower hasn't received it yet" },
    ],
    resolveOutcome: (events) => {
      const write = events.find((event) => event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED);
      if (!write) return undefined;
      const { key, value } = write.payload as WriteAcceptedPayload;

      for (const event of events) {
        if (event.type !== REPLICATION_EVENT_TYPES.READ_SERVED) continue;
        const payload = event.payload as ReadServedPayload;
        if (payload.key !== key) continue;
        return payload.found && payload.value === value ? "yes" : "no";
      }
      return undefined;
    },
  },
  {
    id: "strong-read-forward-dropped",
    question:
      "Pick a guess, then issue a Strong read from a follower, select the MESSAGE_SENT packet it just sent toward the leader, and Drop it. Then, to confirm real time has passed, issue an Eventual read of any other key. Does the original strong read ever resolve?",
    options: [
      { id: "yes", label: "Yes — it retries or times out eventually" },
      { id: "no", label: "No — a dropped forward has no retry and no timeout" },
    ],
    resolveOutcome: (events) => {
      // Same "no natural terminal event for never" problem as
      // Replication's own sync-write quiz (Milestone 32): the second,
      // unrelated eventual read is the bounded proof that time passed
      // while the strong read's own READ_SERVED never showed up.
      const strongRequest = events.find(
        (event) =>
          event.type === REPLICATION_EVENT_TYPES.READ_REQUESTED &&
          (event.payload as ReadRequestedPayload).consistency === "strong",
      );
      if (!strongRequest) return undefined;

      for (const event of events) {
        if (event.type !== REPLICATION_EVENT_TYPES.READ_SERVED) continue;
        const payload = event.payload as ReadServedPayload;
        if (payload.consistency === "strong") return "yes";
        if (payload.consistency === "eventual") return "no";
      }
      return undefined;
    },
  },
];

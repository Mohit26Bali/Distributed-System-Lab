import {
  REPLICATION_EVENT_TYPES,
  type WriteAcceptedPayload,
  type WriteAcknowledgedPayload,
} from "@/modules/replication/replicationEvents";
import type { PredictiveQuizDefinition } from "./quiz";

export const QUORUM_QUIZZES: PredictiveQuizDefinition[] = [
  {
    id: "quorum-write-survives-one-kill",
    question:
      "Pick a guess, then (in Quorum mode) kill exactly one follower and submit a write. Does it still acknowledge?",
    options: [
      { id: "yes", label: "Yes — 3 of 4 nodes is still a majority" },
      { id: "no", label: "No — any dead node blocks a quorum write" },
    ],
    resolveOutcome: (events) => {
      for (const event of events) {
        if (event.type === REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED) return "yes";
      }
      return undefined;
    },
  },
  {
    id: "quorum-write-breaks-with-two-kills",
    question:
      "Pick a guess, then (in Quorum mode, with one follower already dead) kill a SECOND follower and submit a write. Then submit one more write (a different key) to confirm real time has passed. Does the first of these two writes ever acknowledge?",
    options: [
      { id: "yes", label: "Yes — eventually" },
      { id: "no", label: "No — only 2 of 4 nodes are reachable, and majority needs 3" },
    ],
    resolveOutcome: (events) => {
      // Same bounded-resolution trick every prior module's "will this
      // ever happen" quiz has needed (Replication M32, Consistency M35,
      // CAP M37): no timeout exists in this engine, so "never" needs a
      // second, unrelated write as proof that time actually passed.
      const firstAccepted = events.find((event) => event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED);
      if (!firstAccepted) return undefined;
      const watchedKey = (firstAccepted.payload as WriteAcceptedPayload).key;

      for (const event of events) {
        if (
          event.type === REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED &&
          (event.payload as WriteAcknowledgedPayload).key === watchedKey
        ) {
          return "yes";
        }
        if (
          event.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED &&
          (event.payload as WriteAcceptedPayload).key !== watchedKey
        ) {
          return "no";
        }
      }
      return undefined;
    },
  },
];

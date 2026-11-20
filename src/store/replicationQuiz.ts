import { REPLICATION_EVENT_TYPES, type WriteAcceptedPayload, type WriteAcknowledgedPayload } from "@/modules/replication/replicationEvents";
import type { PredictiveQuizDefinition } from "./quiz";

export const REPLICATION_QUIZZES: PredictiveQuizDefinition[] = [
  {
    id: "async-write-then-kill",
    question:
      "Pick a guess, then (in Async mode) submit a write and immediately kill a follower before it could possibly have replicated. Does the write still acknowledge?",
    options: [
      { id: "yes", label: "Yes — it already acknowledged before the kill mattered" },
      { id: "no", label: "No — killing a follower blocks the write" },
    ],
    resolveOutcome: (events) => {
      for (const event of events) {
        if (event.type === REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED) return "yes";
      }
      return undefined;
    },
  },
  {
    id: "sync-write-then-kill",
    question:
      "Pick a guess, then (in Sync mode) submit a write and immediately kill a follower before it can reply. Then submit one more write (any key) to confirm real time has passed. Does the original write ever acknowledge?",
    options: [
      { id: "yes", label: "Yes — eventually" },
      { id: "no", label: "No — it's stuck permanently, no majority escape hatch yet" },
    ],
    resolveOutcome: (events) => {
      // There's no "give up" timeout in this module, so "will never
      // acknowledge" has no terminal event of its own — the second write
      // is the bounded signal that enough time passed while the first
      // stayed unresolved (same principle as Raft's Milestone 24 quizzes:
      // every branch needs a guaranteed resolution, not just the "yes" one).
      const firstAccepted = events.find((e) => e.type === REPLICATION_EVENT_TYPES.WRITE_ACCEPTED);
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
          return "no"; // a second write went through while the first still hasn't
        }
      }
      return undefined;
    },
  },
];

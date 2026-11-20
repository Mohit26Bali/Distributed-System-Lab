import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { RAFT_EVENT_TYPES } from "@/modules/raft/raftEvents";
import type { PredictiveQuizDefinition } from "./quiz";

export const RAFT_QUIZZES: PredictiveQuizDefinition[] = [
  {
    id: "uncontested-election",
    question:
      'Pick a guess, then select any single alive node — with every other node idle — and click "Start Election." Does it become leader?',
    options: [
      { id: "yes", label: "Yes — nobody else is competing for the vote" },
      { id: "no", label: "No — Raft elections are never guaranteed to succeed" },
    ],
    resolveOutcome: (events) => {
      for (const event of events) {
        if (event.type === RAFT_EVENT_TYPES.LEADER_ELECTED) return "yes";
      }
      return undefined;
    },
  },
  {
    id: "partitioned-write-vs-heal",
    question:
      'Pick a guess, then partition the current leader away from everyone else, select it, and click "Submit Entry." Finally, click "Heal." By the moment you heal it, will that entry have committed?',
    options: [
      { id: "yes", label: "Yes, it commits before you heal" },
      { id: "no", label: "No — it can never get a majority while isolated" },
    ],
    resolveOutcome: (events) => {
      for (const event of events) {
        if (event.type === RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED) return "yes";
        if (event.type === NETWORK_EVENT_TYPES.PARTITION_HEALED) return "no";
      }
      return undefined;
    },
  },
];

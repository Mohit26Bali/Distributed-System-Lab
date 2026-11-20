import { RAFT_EVENT_TYPES } from "@/modules/raft/raftEvents";
import type { PredictiveQuizDefinition } from "./quiz";

export const FAULT_INJECTION_QUIZZES: PredictiveQuizDefinition[] = [
  {
    id: "kill-mid-election-recovery",
    question:
      "Pick a guess, then start an election and immediately kill that same candidate before any vote arrives. Does the cluster still elect a leader?",
    options: [
      { id: "yes", label: "Yes — another node's own election timeout takes over" },
      { id: "no", label: "No — the cluster is stuck until you start a new election yourself" },
    ],
    resolveOutcome: (events) => {
      for (const event of events) {
        if (event.type === RAFT_EVENT_TYPES.LEADER_ELECTED) return "yes";
      }
      return undefined;
    },
  },
  {
    id: "composed-faults-converge",
    question:
      "Pick a guess, then partition the leader into a minority, kill a node in the majority, and drop a vote-response during the majority's re-election — all at once. Does the majority still converge on exactly one leader?",
    options: [
      { id: "yes", label: "Yes — Raft's guarantees hold under composed faults, not just one at a time" },
      { id: "no", label: "No — three simultaneous faults is too much" },
    ],
    resolveOutcome: (events) => {
      for (const event of events) {
        if (event.type === RAFT_EVENT_TYPES.LEADER_ELECTED) return "yes";
      }
      return undefined;
    },
  },
];

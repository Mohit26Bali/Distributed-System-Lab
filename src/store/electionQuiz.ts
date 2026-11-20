import type { SimEvent } from "@/simulation/engine/types";
import { ELECTION_EVENT_TYPES, type LeaderElectedPayload } from "@/modules/election/electionEvents";
import type { PredictiveQuizDefinition } from "./quiz";

function firstLeaderElected(events: readonly SimEvent[]): string | undefined {
  for (const event of events) {
    if (event.type === ELECTION_EVENT_TYPES.LEADER_ELECTED) {
      return (event.payload as LeaderElectedPayload).nodeId;
    }
  }
  return undefined;
}

export const ELECTION_QUIZZES: PredictiveQuizDefinition[] = [
  {
    id: "bubble-up-winner",
    question:
      "All five nodes are alive. Pick a guess, then select node 2 and click \"Start Election.\" Who becomes leader?",
    options: [
      { id: "2", label: "Node 2 — it started the election" },
      { id: "3", label: "Node 3" },
      { id: "4", label: "Node 4" },
      { id: "5", label: "Node 5 — the highest-numbered alive node" },
    ],
    resolveOutcome: firstLeaderElected,
  },
  {
    id: "partitioned-leader-split-brain",
    question:
      'Pick a guess, then partition node 5 away from everyone else and select node 1 to "Start Election." Which node becomes the new leader within the reachable group?',
    options: [
      { id: "1", label: "Node 1 — it started the election" },
      { id: "4", label: "Node 4 — the highest alive node node 1 can actually reach" },
      { id: "5", label: "Node 5 — it's still alive, so it still wins" },
    ],
    resolveOutcome: firstLeaderElected,
  },
];

import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { RAFT_EVENT_TYPES, type LogEntryAppendedPayload } from "@/modules/raft/raftEvents";
import type { PredictiveQuizDefinition } from "./quiz";

export const DISTRIBUTED_DATABASE_QUIZZES: PredictiveQuizDefinition[] = [
  {
    id: "get-from-follower-same-tick-as-put",
    question:
      "Pick a guess, then PUT a key on the leader and, in the very same tick — before stepping the simulation forward — GET it from a follower. Does the follower's own KV view already reflect it?",
    options: [
      { id: "yes", label: "Yes — the write is already there" },
      { id: "no", label: "No — replication hasn't had time to arrive yet" },
    ],
    resolveOutcome: (events) => {
      const leaderAppend = events.find((event) => event.type === RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED);
      if (!leaderAppend) return undefined;
      const leaderNodeId = (leaderAppend.payload as LogEntryAppendedPayload).nodeId;
      const leaderTick = leaderAppend.tick;

      for (const event of events) {
        if (event.type !== RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED) continue;
        const payload = event.payload as LogEntryAppendedPayload;
        if (payload.nodeId === leaderNodeId) continue; // skip the leader's own append
        return event.tick === leaderTick ? "yes" : "no";
      }
      return undefined;
    },
  },
  {
    id: "partitioned-follower-catches-up-automatically-after-heal",
    question:
      "Pick a guess, then partition a follower away, PUT a key, wait, and heal the partition — WITHOUT submitting anything new afterward. Does that follower's own KV view ever catch up, just from healing alone?",
    options: [
      { id: "yes", label: "Yes — the leader's ongoing heartbeats catch it up automatically" },
      { id: "no", label: "No — nothing retries without a fresh write, same as the simpler modules" },
    ],
    resolveOutcome: (events) => {
      // Unlike Replication/Consistency/CAP/Quorum's one-shot replicate
      // message, Raft's leader sends heartbeats continuously forever —
      // so a healed follower catches up on its own, no new PUT needed.
      // The follower's own next LOG_ENTRY_COMMITTED after the heal is
      // the guaranteed terminal signal proving that happened.
      const healed = events.find((event) => event.type === NETWORK_EVENT_TYPES.PARTITION_HEALED);
      if (!healed) return undefined;

      for (const event of events) {
        if (event.tick <= healed.tick) continue;
        if (event.type === RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED) return "yes";
      }
      return undefined;
    },
  },
];

import {
  REPLICATION_EVENT_TYPES,
  type ReadRequestedPayload,
  type ReadServedPayload,
} from "@/modules/replication/replicationEvents";
import type { ChallengeDefinition } from "./challenges";

const STRONG_READ_ROUND_TRIP_CHALLENGE_TICKS = 8; // beats the default 3-tick-link round trip (3+3=6)

export const CONSISTENCY_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "divergent-eventual-reads",
    title: "Challenge: Divergent Reads",
    prompt:
      "Write a key, then eventually-read it from two different followers before replication has reached both, so the two reads disagree with each other — without either one reporting an error.",
    isComplete: (events) => {
      const byKey = new Map<string, Set<string>>();
      for (const event of events) {
        if (event.type !== REPLICATION_EVENT_TYPES.READ_SERVED) continue;
        const payload = event.payload as ReadServedPayload;
        if (payload.consistency !== "eventual") continue;
        const signature = payload.found ? `v:${payload.value}` : "not-found";
        const set = byKey.get(payload.key) ?? new Set<string>();
        set.add(signature);
        byKey.set(payload.key, set);
      }
      return [...byKey.values()].some((signatures) => signatures.size > 1);
    },
  },
  {
    id: "slow-strong-read",
    title: "Challenge: The Cost of Being Right",
    prompt: `Raise a leader-follower link's latency, then issue a Strong read from that follower whose round trip takes at least ${STRONG_READ_ROUND_TRIP_CHALLENGE_TICKS} ticks.`,
    isComplete: (events) => {
      let requestTick: number | null = null;
      for (const event of events) {
        if (event.type === REPLICATION_EVENT_TYPES.READ_REQUESTED) {
          const payload = event.payload as ReadRequestedPayload;
          if (payload.consistency === "strong") requestTick = event.tick;
          continue;
        }
        if (event.type !== REPLICATION_EVENT_TYPES.READ_SERVED) continue;
        const payload = event.payload as ReadServedPayload;
        if (payload.consistency !== "strong" || requestTick === null) continue;
        if (event.tick - requestTick >= STRONG_READ_ROUND_TRIP_CHALLENGE_TICKS) return true;
        requestTick = null;
      }
      return false;
    },
  },
];

import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { NODE_EVENT_TYPES } from "@/simulation/events/nodeEvents";
import { RAFT_EVENT_TYPES, type LogEntryCommittedPayload } from "@/modules/raft/raftEvents";
import type { GuidedStepDefinition } from "./guidedSteps";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function distinctCommittedNodeIds(events: readonly SimEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.type === RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED) ids.add((event.payload as LogEntryCommittedPayload).nodeId);
  }
  return ids;
}

function countEventType(events: readonly SimEvent[], type: string): number {
  return events.filter((event) => event.type === type).length;
}

// GET never dispatches anything (it's a pure computation, displayed
// locally — see docs/24-distributed-database-module-design.md), so
// isSatisfied here can only verify the PUT/fault side of each step; the
// instruction text asks the learner to also GET as the visual payoff,
// but that part isn't independently checkable from the event log.
export const DISTRIBUTED_DATABASE_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "put-and-commit",
    instruction: "Start an election on any node to bootstrap the cluster, then PUT a key on the leader.",
    observation:
      "LOG_ENTRY_APPENDED committed to the leader's own log immediately, and LOG_ENTRY_COMMITTED followed once a majority replicated it — check the leader's own KV store in the inspector.",
    isSatisfied: (events) =>
      hasEventType(events, RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED) &&
      hasEventType(events, RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED),
  },
  {
    id: "get-from-follower-once-caught-up",
    instruction: "GET the same key from a different node, once its own commit index shows it's caught up.",
    observation:
      "That follower's own KV view now matches the leader's — derived purely from its own log and its own commit progress, nothing shared between nodes.",
    isSatisfied: (events) => distinctCommittedNodeIds(events).size >= 2,
  },
  {
    id: "survive-a-leader-failure",
    instruction:
      "PUT another key, then kill the current leader. Start an election on a different node once it wins, then GET the original key from the new leader.",
    observation:
      "The new leader's own KV store still has everything the old one committed — no data was lost, because a majority already held it before the crash.",
    isSatisfied: (events) =>
      countEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED) >= 2 && hasEventType(events, NODE_EVENT_TYPES.NODE_CRASHED),
  },
  {
    id: "partitioned-follower-frozen-view",
    instruction: "Partition a follower away from the rest, PUT one more key, then GET that key from the cut-off follower.",
    observation:
      "Its own commit index never advances past what it already had — the KV view is frozen, exactly like Consistency's stale reads, except now it's Raft's own commit safety producing the effect, not a simpler ack count.",
    isSatisfied: (events) =>
      hasEventType(events, NETWORK_EVENT_TYPES.PARTITION_STARTED) &&
      hasEventType(events, RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED),
  },
];

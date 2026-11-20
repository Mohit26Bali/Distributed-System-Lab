import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { NODE_EVENT_TYPES } from "@/simulation/events/nodeEvents";
import {
  RAFT_EVENT_TYPES,
  type ElectionStartedPayload,
  type LogEntryAppendedPayload,
  type LogEntryCommittedPayload,
} from "@/modules/raft/raftEvents";
import type { ChallengeDefinition } from "./challenges";

function survivesALeaderCrash(events: readonly SimEvent[]): boolean {
  const firstCommittedTick = events.find((e) => e.type === RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED)?.tick;
  if (firstCommittedTick === undefined) return false;
  return events.some((e) => e.type === NODE_EVENT_TYPES.NODE_CRASHED && e.tick >= firstCommittedTick);
}

function causedALostEntry(events: readonly SimEvent[]): boolean {
  const appendedIndices = new Set(
    events
      .filter((e) => e.type === RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED)
      .map((e) => (e.payload as LogEntryAppendedPayload).index),
  );
  const committedIndices = new Set(
    events
      .filter((e) => e.type === RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED)
      .map((e) => (e.payload as LogEntryCommittedPayload).index),
  );
  const hasFault = events.some(
    (e) => e.type === NETWORK_EVENT_TYPES.PARTITION_STARTED || e.type === NODE_EVENT_TYPES.NODE_CRASHED,
  );
  const hasUncommittedAppend = [...appendedIndices].some((index) => !committedIndices.has(index));
  return hasFault && hasUncommittedAppend;
}

function causedASplitVote(events: readonly SimEvent[]): boolean {
  const nodeIdsByTerm = new Map<number, Set<string>>();
  for (const event of events) {
    if (event.type !== RAFT_EVENT_TYPES.ELECTION_STARTED) continue;
    const { nodeId, term } = event.payload as ElectionStartedPayload;
    if (!nodeIdsByTerm.has(term)) nodeIdsByTerm.set(term, new Set());
    nodeIdsByTerm.get(term)!.add(nodeId);
  }
  return [...nodeIdsByTerm.values()].some((nodeIds) => nodeIds.size >= 2);
}

export const RAFT_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "entry-survives-leader-crash",
    title: "Challenge: Survive a Crash",
    prompt: "Get an entry committed, then kill the leader that committed it. Confirm the entry is still there.",
    isComplete: survivesALeaderCrash,
  },
  {
    id: "cause-a-lost-entry",
    title: "Challenge: Lose an Entry",
    prompt:
      "Make a submitted entry get accepted into some node's log but never committed cluster-wide — a partition or a well-timed crash is the key ingredient.",
    isComplete: causedALostEntry,
  },
  {
    id: "cause-a-split-vote",
    title: "Challenge: Split Vote",
    prompt: "Get two different nodes to start an election in the very same term.",
    isComplete: causedASplitVote,
  },
];

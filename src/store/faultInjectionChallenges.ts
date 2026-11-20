import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { NODE_EVENT_TYPES } from "@/simulation/events/nodeEvents";
import { RAFT_EVENT_TYPES, type ElectionStartedPayload } from "@/modules/raft/raftEvents";
import type { ChallengeDefinition } from "./challenges";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function hasElectionStartedReason(events: readonly SimEvent[], reason: ElectionStartedPayload["reason"]): boolean {
  return events.some(
    (event) =>
      event.type === RAFT_EVENT_TYPES.ELECTION_STARTED &&
      (event.payload as ElectionStartedPayload).reason === reason,
  );
}

const FAULT_EVENT_TYPES: string[] = [
  NODE_EVENT_TYPES.NODE_CRASHED,
  NETWORK_EVENT_TYPES.PARTITION_STARTED,
  NETWORK_EVENT_TYPES.MESSAGE_DROPPED,
  NETWORK_EVENT_TYPES.MESSAGE_REORDERED,
  NETWORK_EVENT_TYPES.MESSAGE_DUPLICATED,
];

function distinctFaultTypesUsed(events: readonly SimEvent[]): number {
  const seen = new Set(events.map((e) => e.type).filter((type) => FAULT_EVENT_TYPES.includes(type)));
  return seen.size;
}

export const FAULT_INJECTION_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "late-vote-doesnt-count",
    title: "Challenge: Too Late to Count",
    prompt:
      "Reorder a vote-response so far that the candidate's own election timeout fires and it restarts at a new term before the response arrives — then confirm a leader still gets elected.",
    isComplete: (events) => hasElectionStartedReason(events, "election-timeout") && hasEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED),
  },
  {
    id: "election-survives-dropped-vote",
    title: "Challenge: Missing Voter",
    prompt: "Cause an election to succeed despite one voter's request-vote message being dropped.",
    isComplete: (events) => hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_DROPPED) && hasEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED),
  },
  {
    id: "compose-three-faults",
    title: "Challenge: Three At Once",
    prompt:
      "Compose at least three different kinds of fault (kill/partition/drop/reorder/duplicate) into one scenario and still reach exactly one leader.",
    isComplete: (events) => distinctFaultTypesUsed(events) >= 3 && hasEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED),
  },
];

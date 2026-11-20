import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { NODE_EVENT_TYPES } from "@/simulation/events/nodeEvents";
import { RAFT_EVENT_TYPES, type ElectionStartedPayload } from "@/modules/raft/raftEvents";
import type { GuidedStepDefinition } from "./guidedSteps";

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

// Every step here composes faults against the same Raft engine the `raft`
// module already proved correct in isolation — nothing new is being taught
// about the protocol, only about its behavior under adversarial timing.
export const FAULT_INJECTION_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "kill-mid-election",
    instruction:
      'Start an election on any node, then immediately select that same node and click "Kill Node" — before any vote can possibly arrive.',
    observation:
      "The cluster didn't get stuck. Once the killed candidate's silence is noticed (via another node's own election timeout), a fresh election runs to completion automatically.",
    isSatisfied: (events) => hasEventType(events, NODE_EVENT_TYPES.NODE_CRASHED) && hasEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED),
  },
  {
    id: "delay-vote-past-timeout",
    instruction:
      'Start an election. Once a voter replies (a packet appears heading back), select it and click "Reorder" with a large delay. Then just wait for the candidate to restart on its own.',
    observation:
      "A fresh ELECTION_STARTED with reason \"election-timeout\" appeared — the candidate gave up waiting and restarted at a new term. When the long-delayed response finally arrives, check the inspector: it changed nothing.",
    isSatisfied: (events) => hasElectionStartedReason(events, "election-timeout"),
  },
  {
    id: "drop-one-vote-request",
    instruction:
      'Start an election, then select the request-vote packet headed to one specific voter and click "Drop Message."',
    observation:
      "That voter never even heard about the election — but the remaining voters were still enough for a majority, and the election succeeded anyway.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_DROPPED) && hasEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED),
  },
  {
    id: "duplicate-heartbeat",
    instruction:
      "Once a leader exists, select one of its outgoing heartbeat packets mid-flight and click \"Duplicate.\"",
    observation:
      "Check the inspector on the receiving follower: its log and commit index are exactly the same as before. Processing the same AppendEntries twice changed nothing.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_DUPLICATED),
  },
  {
    id: "compose-three-faults",
    instruction:
      'Partition the current leader into a 1-node minority, kill one node on the majority side, and drop a vote-response during the majority\'s automatic re-election — all in the same scenario.',
    observation:
      "Three simultaneous faults, and the majority still converged on exactly one new leader. Raft's guarantees don't just hold one fault at a time.",
    isSatisfied: (events) =>
      hasEventType(events, NETWORK_EVENT_TYPES.PARTITION_STARTED) &&
      hasEventType(events, NODE_EVENT_TYPES.NODE_CRASHED) &&
      hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_DROPPED) &&
      hasEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED),
  },
];

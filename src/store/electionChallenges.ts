import type { SimEvent } from "@/simulation/engine/types";
import {
  ELECTION_EVENT_TYPES,
  type ElectionStartedPayload,
  type NodeRoleChangedPayload,
} from "@/modules/election/electionEvents";
import type { ChallengeDefinition } from "./challenges";

function hasElectionStartedReason(events: readonly SimEvent[], reason: ElectionStartedPayload["reason"]): boolean {
  return events.some(
    (event) =>
      event.type === ELECTION_EVENT_TYPES.ELECTION_STARTED &&
      (event.payload as ElectionStartedPayload).reason === reason,
  );
}

/** How many nodes currently hold role "leader", per the last role change each has seen. */
function countCurrentLeaders(events: readonly SimEvent[]): number {
  const latestRoleByNode = new Map<string, string>();
  for (const event of events) {
    if (event.type !== ELECTION_EVENT_TYPES.NODE_ROLE_CHANGED) continue;
    const payload = event.payload as NodeRoleChangedPayload;
    latestRoleByNode.set(payload.nodeId, payload.role);
  }
  return [...latestRoleByNode.values()].filter((role) => role === "leader").length;
}

export const ELECTION_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "elect-via-bubble-up",
    title: "Challenge: Win Without Starting It",
    prompt:
      "Cause a node to become leader without ever selecting that node yourself — start the election on a lower-priority node and let it bubble up.",
    isComplete: (events) => hasElectionStartedReason(events, "bubbled-up"),
  },
  {
    id: "cause-split-brain",
    title: "Challenge: Split Brain",
    prompt:
      "Make two different nodes simultaneously believe they're the leader. A partition is the key ingredient.",
    isComplete: (events) => countCurrentLeaders(events) >= 2,
  },
  {
    id: "cause-coordinator-timeout-restart",
    title: "Challenge: Force a Restart",
    prompt:
      "Make a candidate's election restart because it got an OK but never heard who won — kill the node that answered OK before it can announce itself.",
    isComplete: (events) => hasElectionStartedReason(events, "no-coordinator-timeout"),
  },
];

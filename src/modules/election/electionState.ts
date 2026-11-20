import type { Message } from "../../simulation/models/Message";
import type { NodeStatus } from "../../simulation/models/Node";
import type { ElectionRole } from "./electionEvents";

export interface ElectionNodeState {
  id: string;
  status: NodeStatus;
  role: ElectionRole;
  /**
   * True once a candidate has received at least one OK — distinguishes
   * "still waiting for a first reply" (ELECTION_TIMEOUT governs) from
   * "got a reply, now waiting for the winner's announcement"
   * (COORDINATOR_TIMEOUT governs). See docs/10-election-module-design.md.
   */
  awaitingCoordinator: boolean;
}

export interface ElectionState {
  nodes: Record<string, ElectionNodeState>;
  messages: Record<string, Message>;
  nextMessageId: number;
}

/** Bully's total order: node ids are numeric strings, higher number wins. */
export function priorityOf(nodeId: string): number {
  return Number(nodeId);
}

export function createInitialElectionState(nodeIds: string[]): ElectionState {
  const nodes: Record<string, ElectionNodeState> = {};
  for (const id of nodeIds) {
    nodes[id] = { id, status: "alive", role: "follower", awaitingCoordinator: false };
  }
  return { nodes, messages: {}, nextMessageId: 0 };
}

import type { Message } from "../../simulation/models/Message";
import type { NodeState } from "../../simulation/models/Node";

export interface NetworkingState {
  nodes: Record<string, NodeState>;
  messages: Record<string, Message>;
  nextMessageId: number;
}

export function createInitialNetworkingState(nodeIds: string[]): NetworkingState {
  const nodes: Record<string, NodeState> = {};
  for (const id of nodeIds) {
    nodes[id] = { id, status: "alive" };
  }
  return { nodes, messages: {}, nextMessageId: 0 };
}

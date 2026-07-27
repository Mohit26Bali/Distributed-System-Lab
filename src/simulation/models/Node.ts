export type NodeStatus = "alive" | "crashed";

export interface NodeState {
  id: string;
  status: NodeStatus;
}

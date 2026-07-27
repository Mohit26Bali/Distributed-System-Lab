// Only "alive" exists until Milestone 9 gives the engine a truthful way
// to produce "crashed" — see docs/09-implementation-roadmap.md.
export type NodeStatus = "alive";

export interface NodeState {
  id: string;
  status: NodeStatus;
}

import type { Message } from "../../simulation/models/Message";
import type { NodeStatus } from "../../simulation/models/Node";
import type { ReplicationMode } from "./replicationEvents";

export interface ReplicationNodeState {
  id: string;
  status: NodeStatus;
  role: "leader" | "follower"; // static for the whole session — no election in this module
  store: Record<string, string>;
}

export interface PendingSyncWrite {
  key: string;
  value: string;
  /** Alive-at-write-time followers that haven't replicate-ack'd yet. */
  awaiting: string[];
}

export interface PendingQuorumWrite {
  key: string;
  value: string;
  /** Followers that have replicate-ack'd so far — the leader's own local
   * write always counts as one additional ack, so this resolves once
   * ackedBy.length + 1 reaches `required`. */
  ackedBy: string[];
  required: number;
}

export interface QuorumReadResponse {
  nodeId: string;
  value?: string;
  version: number;
  found: boolean;
}

export interface PendingQuorumRead {
  key: string;
  initiatorNodeId: string;
  /** Includes the initiator's own local answer as the first entry. */
  responses: QuorumReadResponse[];
  required: number;
}

export interface ReplicationState {
  nodes: Record<string, ReplicationNodeState>;
  messages: Record<string, Message>;
  nextMessageId: number;
  nextQuorumRequestId: number;
  mode: ReplicationMode;
  pendingSyncWrites: Record<string, PendingSyncWrite>;
  pendingQuorumWrites: Record<string, PendingQuorumWrite>;
  pendingQuorumReads: Record<string, PendingQuorumRead>;
  /** The version last assigned to each key — a plain write counter (not a
   * content hash), incremented by the leader on every WRITE regardless of
   * whether the value actually changed. Lets a quorum read tell which of
   * several disagreeing replicas is most recent. */
  writeVersions: Record<string, number>;
  /** Per node, the version of each key that node has actually applied —
   * the leader's own entry is always current; a follower's lags until its
   * `replicate` message delivers. */
  storeVersions: Record<string, Record<string, number>>;
}

export function createInitialReplicationState(leaderId: string, followerIds: string[]): ReplicationState {
  const nodes: Record<string, ReplicationNodeState> = {
    [leaderId]: { id: leaderId, status: "alive", role: "leader", store: {} },
  };
  const storeVersions: Record<string, Record<string, number>> = { [leaderId]: {} };
  for (const id of followerIds) {
    nodes[id] = { id, status: "alive", role: "follower", store: {} };
    storeVersions[id] = {};
  }
  return {
    nodes,
    messages: {},
    nextMessageId: 0,
    nextQuorumRequestId: 0,
    mode: "async",
    pendingSyncWrites: {},
    pendingQuorumWrites: {},
    pendingQuorumReads: {},
    writeVersions: {},
    storeVersions,
  };
}

/** Majority of the TOTAL cluster size, not just alive nodes — same
 * precedent as Raft's own majority-from-total-cluster rule, so that too
 * many dead nodes means quorum is genuinely, permanently unreachable
 * rather than silently redefined down. */
export function majorityOf(totalNodes: number): number {
  return Math.floor(totalNodes / 2) + 1;
}

export function otherAliveNodeIds(state: ReplicationState, nodeId: string): string[] {
  return Object.values(state.nodes)
    .filter((n) => n.status === "alive" && n.id !== nodeId)
    .map((n) => n.id);
}

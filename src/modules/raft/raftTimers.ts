export interface DeliverRaftMessageTimerPayload {
  type: "DELIVER_MESSAGE";
  messageId: string;
}

export interface ElectionTimeoutTimerPayload {
  type: "ELECTION_TIMEOUT";
  nodeId: string;
  /** Must match the node's current electionTimeoutToken or this firing is stale. */
  token: number;
}

export interface HeartbeatTimerPayload {
  type: "HEARTBEAT_TIMER";
  nodeId: string;
}

export type RaftTimerPayload =
  | DeliverRaftMessageTimerPayload
  | ElectionTimeoutTimerPayload
  | HeartbeatTimerPayload;

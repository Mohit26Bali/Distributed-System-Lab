export interface DeliverElectionMessageTimerPayload {
  type: "DELIVER_MESSAGE";
  messageId: string;
}

export interface ElectionTimeoutTimerPayload {
  type: "ELECTION_TIMEOUT";
  nodeId: string;
}

export interface CoordinatorTimeoutTimerPayload {
  type: "COORDINATOR_TIMEOUT";
  nodeId: string;
}

export type ElectionTimerPayload =
  | DeliverElectionMessageTimerPayload
  | ElectionTimeoutTimerPayload
  | CoordinatorTimeoutTimerPayload;

export interface DeliverReplicationMessageTimerPayload {
  type: "DELIVER_MESSAGE";
  messageId: string;
}

export type ReplicationTimerPayload = DeliverReplicationMessageTimerPayload;

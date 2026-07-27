import type { SimEventDraft, Tick } from "../engine/types";

export const NETWORK_EVENT_TYPES = {
  MESSAGE_SENT: "MESSAGE_SENT",
  MESSAGE_DELIVERED: "MESSAGE_DELIVERED",
} as const;

export interface MessageSentPayload {
  messageId: string;
  from: string;
  to: string;
  sentTick: Tick;
  deliveredTick: Tick;
}

export interface MessageDeliveredPayload {
  messageId: string;
}

export function messageSentEvent(moduleId: string, payload: MessageSentPayload): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.MESSAGE_SENT, moduleId, payload };
}

export function messageDeliveredEvent(
  moduleId: string,
  payload: MessageDeliveredPayload,
): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.MESSAGE_DELIVERED, moduleId, payload };
}

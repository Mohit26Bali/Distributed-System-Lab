import type { SimEventDraft, Tick } from "../engine/types";

export const NETWORK_EVENT_TYPES = {
  MESSAGE_SENT: "MESSAGE_SENT",
  MESSAGE_DELIVERED: "MESSAGE_DELIVERED",
  MESSAGE_DROPPED: "MESSAGE_DROPPED",
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

export interface MessageDroppedPayload {
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

/**
 * A drop is always its own committed fact, never an omitted delivery — the
 * timeline, inspector, and any future analytics must be able to answer
 * "why did this message never arrive" from the log itself.
 */
export function messageDroppedEvent(
  moduleId: string,
  payload: MessageDroppedPayload,
): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.MESSAGE_DROPPED, moduleId, payload };
}

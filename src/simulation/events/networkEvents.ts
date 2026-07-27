import type { SimEventDraft, Tick } from "../engine/types";

export const NETWORK_EVENT_TYPES = {
  MESSAGE_SENT: "MESSAGE_SENT",
  MESSAGE_DELIVERED: "MESSAGE_DELIVERED",
  MESSAGE_DROPPED: "MESSAGE_DROPPED",
  MESSAGE_REORDERED: "MESSAGE_REORDERED",
  MESSAGE_DUPLICATED: "MESSAGE_DUPLICATED",
  NETWORK_CONFIG_CHANGED: "NETWORK_CONFIG_CHANGED",
  PARTITION_STARTED: "PARTITION_STARTED",
  PARTITION_HEALED: "PARTITION_HEALED",
} as const;

export type MessageDropReason = "destination-crashed" | "partitioned" | "random-loss" | "manual";

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
  /** Why it never arrived — always explicit, never inferred by the UI. */
  reason: MessageDropReason;
}

export interface MessageReorderedPayload {
  messageId: string;
  previousDeliveredTick: Tick;
  newDeliveredTick: Tick;
}

export interface MessageDuplicatedPayload {
  originalMessageId: string;
  duplicateMessageId: string;
}

export interface NetworkConfigChangedPayload {
  from: string;
  to: string;
  latencyTicks?: number;
  dropRate?: number;
}

export interface PartitionStartedPayload {
  groups: string[][];
}

export type PartitionHealedPayload = Record<string, never>;

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

export function messageReorderedEvent(
  moduleId: string,
  payload: MessageReorderedPayload,
): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.MESSAGE_REORDERED, moduleId, payload };
}

export function messageDuplicatedEvent(
  moduleId: string,
  payload: MessageDuplicatedPayload,
): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.MESSAGE_DUPLICATED, moduleId, payload };
}

export function networkConfigChangedEvent(
  moduleId: string,
  payload: NetworkConfigChangedPayload,
): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.NETWORK_CONFIG_CHANGED, moduleId, payload };
}

export function partitionStartedEvent(
  moduleId: string,
  payload: PartitionStartedPayload,
): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.PARTITION_STARTED, moduleId, payload };
}

export function partitionHealedEvent(moduleId: string): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.PARTITION_HEALED, moduleId, payload: {} };
}

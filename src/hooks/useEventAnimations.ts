import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import {
  NETWORK_EVENT_TYPES,
  type MessageDeliveredPayload,
  type MessageSentPayload,
} from "@/simulation/events/networkEvents";

export interface MessageIndexEntry {
  sent: MessageSentPayload;
  delivered: boolean;
}

/**
 * Projects the event log into "what do we know about each message as of
 * `tick`." The single shared place the "don't let future events leak
 * backward" rule lives — every other message-related derivation (packet
 * animation, inspector detail) builds on this instead of re-scanning
 * events with its own copy of the same tick-filtering logic.
 */
export function indexMessagesUpTo(
  events: readonly SimEvent[],
  tick: Tick,
): Map<string, MessageIndexEntry> {
  const index = new Map<string, MessageIndexEntry>();

  for (const event of events) {
    if (event.tick > tick) continue;

    if (event.type === NETWORK_EVENT_TYPES.MESSAGE_SENT) {
      const payload = event.payload as MessageSentPayload;
      index.set(payload.messageId, { sent: payload, delivered: false });
    } else if (event.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED) {
      const payload = event.payload as MessageDeliveredPayload;
      const entry = index.get(payload.messageId);
      if (entry) entry.delivered = true;
    }
  }

  return index;
}

export interface PacketAnimation {
  id: string;
  from: string;
  to: string;
  /** 0..1, purely derived from tick position — never a wall-clock value. */
  progress: number;
}

/**
 * Derives "what should currently be animating" as of `currentTick`. A
 * packet exists here if and only if it's been sent but not yet delivered
 * as of `currentTick` — nothing here is ever inferred or guessed, only
 * read back from what the engine already committed.
 */
export function deriveActivePackets(
  events: readonly SimEvent[],
  currentTick: Tick,
): PacketAnimation[] {
  const index = indexMessagesUpTo(events, currentTick);

  const packets: PacketAnimation[] = [];
  for (const [messageId, entry] of index) {
    if (entry.delivered) continue;

    const { sentTick, deliveredTick, from, to } = entry.sent;
    const span = deliveredTick - sentTick;
    const progress = span <= 0 ? 1 : Math.min(1, Math.max(0, (currentTick - sentTick) / span));

    packets.push({ id: messageId, from, to, progress });
  }

  return packets;
}

export function useEventAnimations(
  events: readonly SimEvent[],
  currentTick: Tick,
): { packets: PacketAnimation[] } {
  return useMemo(
    () => ({ packets: deriveActivePackets(events, currentTick) }),
    [events, currentTick],
  );
}

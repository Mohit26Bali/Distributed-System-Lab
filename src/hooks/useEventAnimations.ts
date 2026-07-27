import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import {
  NETWORK_EVENT_TYPES,
  type MessageDeliveredPayload,
  type MessageSentPayload,
} from "@/simulation/events/networkEvents";

export interface PacketAnimation {
  id: string;
  from: string;
  to: string;
  /** 0..1, purely derived from tick position — never a wall-clock value. */
  progress: number;
}

/**
 * Derives "what should currently be animating" from the committed event
 * log. A packet exists here if and only if the log has its MESSAGE_SENT
 * with no matching MESSAGE_DELIVERED yet — nothing here is ever inferred
 * or guessed, only read back from what the engine already committed.
 */
export function useEventAnimations(
  events: readonly SimEvent[],
  currentTick: Tick,
): { packets: PacketAnimation[] } {
  return useMemo(() => {
    const sent = new Map<string, MessageSentPayload>();
    const delivered = new Set<string>();

    for (const event of events) {
      if (event.type === NETWORK_EVENT_TYPES.MESSAGE_SENT) {
        const payload = event.payload as MessageSentPayload;
        sent.set(payload.messageId, payload);
      } else if (event.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED) {
        const payload = event.payload as MessageDeliveredPayload;
        delivered.add(payload.messageId);
      }
    }

    const packets: PacketAnimation[] = [];
    for (const [messageId, payload] of sent) {
      if (delivered.has(messageId)) continue;

      const span = payload.deliveredTick - payload.sentTick;
      const progress =
        span <= 0 ? 1 : Math.min(1, Math.max(0, (currentTick - payload.sentTick) / span));

      packets.push({ id: messageId, from: payload.from, to: payload.to, progress });
    }

    return { packets };
  }, [events, currentTick]);
}

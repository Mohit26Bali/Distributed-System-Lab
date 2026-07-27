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
 * Derives "what should currently be animating" as of `currentTick` from the
 * committed event log. A packet exists here if and only if the log has its
 * MESSAGE_SENT at or before `currentTick`, with no matching MESSAGE_DELIVERED
 * also at or before `currentTick` — nothing here is ever inferred or
 * guessed, only read back from what the engine already committed.
 *
 * The `currentTick` bound matters once the UI can view a tick behind the
 * live one (Milestone 6's timeline scrub): the event log may already
 * contain a later MESSAGE_DELIVERED from the live engine's future relative
 * to whatever tick is being viewed, and that must not leak backward.
 */
export function deriveActivePackets(
  events: readonly SimEvent[],
  currentTick: Tick,
): PacketAnimation[] {
  const sent = new Map<string, MessageSentPayload>();
  const delivered = new Set<string>();

  for (const event of events) {
    if (event.tick > currentTick) continue;

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

import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import {
  NETWORK_EVENT_TYPES,
  type MessageDeliveredPayload,
  type MessageDroppedPayload,
  type MessageSentPayload,
} from "@/simulation/events/networkEvents";

export type MessageResolution = "in-flight" | "delivered" | "dropped";

export interface MessageIndexEntry {
  sent: MessageSentPayload;
  resolution: MessageResolution;
  /** The tick at which resolution became "delivered"/"dropped"; unset while in-flight. */
  resolvedTick?: Tick;
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
      index.set(payload.messageId, { sent: payload, resolution: "in-flight" });
    } else if (event.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED) {
      const payload = event.payload as MessageDeliveredPayload;
      const entry = index.get(payload.messageId);
      if (entry) {
        entry.resolution = "delivered";
        entry.resolvedTick = event.tick;
      }
    } else if (event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED) {
      const payload = event.payload as MessageDroppedPayload;
      const entry = index.get(payload.messageId);
      if (entry) {
        entry.resolution = "dropped";
        entry.resolvedTick = event.tick;
      }
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
  /** "dropped" is only ever present for the exact tick the drop happened. */
  status: "in-flight" | "dropped";
}

function progressAt(sentTick: Tick, deliveredTick: Tick, atTick: Tick): number {
  const span = deliveredTick - sentTick;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (atTick - sentTick) / span));
}

/**
 * Derives "what should currently be animating" as of `currentTick`. A
 * packet exists here if and only if it's unresolved as of `currentTick`
 * (still in flight), or it was just dropped exactly at `currentTick` (a
 * one-tick flash before it disappears) — nothing here is ever inferred or
 * guessed, only read back from what the engine already committed.
 */
export function deriveActivePackets(
  events: readonly SimEvent[],
  currentTick: Tick,
): PacketAnimation[] {
  const index = indexMessagesUpTo(events, currentTick);

  const packets: PacketAnimation[] = [];
  for (const [messageId, entry] of index) {
    const { sentTick, deliveredTick, from, to } = entry.sent;

    if (entry.resolution === "delivered") continue;

    if (entry.resolution === "dropped") {
      if (entry.resolvedTick !== currentTick) continue;
      packets.push({
        id: messageId,
        from,
        to,
        progress: progressAt(sentTick, deliveredTick, entry.resolvedTick),
        status: "dropped",
      });
      continue;
    }

    packets.push({
      id: messageId,
      from,
      to,
      progress: progressAt(sentTick, deliveredTick, currentTick),
      status: "in-flight",
    });
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

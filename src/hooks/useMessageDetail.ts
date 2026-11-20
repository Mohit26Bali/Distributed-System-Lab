import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";
import type { MessageDropReason } from "@/simulation/events/networkEvents";
import { indexMessagesUpTo } from "./useEventAnimations";

export interface MessageDetail {
  messageId: string;
  from: string;
  to: string;
  sentTick: Tick;
  deliveredTick: Tick;
  status: "in-flight" | "delivered" | "dropped";
  /** Only present when status is "dropped" — never inferred, always the committed fact. */
  dropReason?: MessageDropReason;
  /**
   * Only present for modules that tag their MESSAGE_SENT payload with a
   * `kind` (e.g. election's ELECTION/OK/COORDINATOR) — see
   * docs/10-election-module-design.md. Absent for plain networking pings.
   */
  kind?: string;
}

/**
 * Full detail for one message as of `viewTick`, for the inspector.
 * Returns undefined if the message hasn't been sent yet as of that tick —
 * e.g. the learner selected it, then scrubbed back before it existed.
 */
export function deriveMessageDetail(
  events: readonly SimEvent[],
  messageId: string,
  viewTick: Tick,
): MessageDetail | undefined {
  const entry = indexMessagesUpTo(events, viewTick).get(messageId);
  if (!entry) return undefined;

  const { from, to, sentTick, deliveredTick } = entry.sent;
  const kind = (entry.sent as { kind?: string }).kind;
  return {
    messageId,
    from,
    to,
    sentTick,
    deliveredTick,
    status: entry.resolution,
    dropReason: entry.dropReason,
    kind,
  };
}

export function useMessageDetail(
  events: readonly SimEvent[],
  messageId: string | null,
  viewTick: Tick,
): MessageDetail | undefined {
  return useMemo(
    () => (messageId ? deriveMessageDetail(events, messageId, viewTick) : undefined),
    [events, messageId, viewTick],
  );
}

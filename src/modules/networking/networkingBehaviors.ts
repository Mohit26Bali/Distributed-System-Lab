import { messageDeliveredEvent, messageDroppedEvent } from "../../simulation/events/networkEvents";
import type { ReduceResult } from "../../simulation/engine/types";
import { NETWORKING_MODULE_ID } from "./constants";
import type { NetworkingState } from "./networkingState";

export interface DeliverMessageTimerPayload {
  type: "DELIVER_MESSAGE";
  messageId: string;
}

/**
 * What happens when a scheduled message-delivery timer fires. Only the
 * destination's aliveness at delivery time matters — a message from a
 * node that later crashes still lands (the asymmetry is intentional, see
 * docs/04-simulation-engine.md: it was already "in the network" when its
 * sender died).
 */
export function onNetworkingTimer(
  state: NetworkingState,
  payload: unknown,
): ReduceResult<NetworkingState> {
  const timer = payload as DeliverMessageTimerPayload;
  const message = state.messages[timer.messageId];

  // The message may have already been resolved by the time this fires —
  // e.g. manually dropped earlier. This timer entry is now stale: nothing
  // new happened, so no event.
  if (!message || message.status !== "in-flight") {
    return { state, events: [] };
  }

  const destinationNode = state.nodes[message.to];
  if (destinationNode?.status === "crashed") {
    return {
      state: {
        ...state,
        messages: {
          ...state.messages,
          [timer.messageId]: { ...message, status: "dropped" },
        },
      },
      events: [messageDroppedEvent(NETWORKING_MODULE_ID, { messageId: timer.messageId })],
    };
  }

  return {
    state: {
      ...state,
      messages: {
        ...state.messages,
        [timer.messageId]: { ...message, status: "delivered" },
      },
    },
    events: [messageDeliveredEvent(NETWORKING_MODULE_ID, { messageId: timer.messageId })],
  };
}

import { messageDeliveredEvent } from "../../simulation/events/networkEvents";
import type { ReduceResult } from "../../simulation/engine/types";
import { NETWORKING_MODULE_ID } from "./constants";
import type { NetworkingState } from "./networkingState";

export interface DeliverMessageTimerPayload {
  type: "DELIVER_MESSAGE";
  messageId: string;
}

/** What a node does when a scheduled timer fires — currently just message delivery. */
export function onNetworkingTimer(
  state: NetworkingState,
  payload: unknown,
): ReduceResult<NetworkingState> {
  const timer = payload as DeliverMessageTimerPayload;
  const message = state.messages[timer.messageId];

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

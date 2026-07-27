import { messageDeliveredEvent, messageDroppedEvent } from "../../simulation/events/networkEvents";
import type { ReduceContext, ReduceResult } from "../../simulation/engine/types";
import { NETWORKING_MODULE_ID } from "./constants";
import type { NetworkingState } from "./networkingState";

export interface DeliverMessageTimerPayload {
  type: "DELIVER_MESSAGE";
  messageId: string;
}

/**
 * What happens when a scheduled message-delivery timer fires. Checks, in
 * order:
 *
 * 1. Is this timer stale? Either the message already resolved (e.g.
 *    manually dropped earlier), or it was reordered to a later tick and a
 *    fresh timer is already scheduled for the corrected time — either way,
 *    nothing new happened here, so no event.
 * 2. Is the destination crashed right now? Only the destination's
 *    liveness AT DELIVERY TIME matters — a message from a node that later
 *    crashes still lands (see docs/04-simulation-engine.md).
 * 3. Is this link partitioned right now? Same "checked at arrival, not at
 *    send" rule as node crashes.
 * 4. Does this link's configured drop-rate roll a loss this time? Drawn
 *    from the engine's seeded PRNG, never Math.random().
 */
export function onNetworkingTimer(
  state: NetworkingState,
  payload: unknown,
  ctx: ReduceContext,
): ReduceResult<NetworkingState> {
  const timer = payload as DeliverMessageTimerPayload;
  const message = state.messages[timer.messageId];

  if (!message || message.status !== "in-flight") {
    return { state, events: [] };
  }
  if (message.deliveredTick !== ctx.tick) {
    return { state, events: [] }; // stale: reordered to a different tick
  }

  const destinationNode = state.nodes[message.to];
  const destinationCrashed = destinationNode?.status === "crashed";
  const partitioned = ctx.network.isPartitioned(message.from, message.to);
  const randomlyLost = ctx.random.next() < ctx.network.getDropRate(message.from, message.to);

  if (destinationCrashed || partitioned || randomlyLost) {
    const reason = destinationCrashed ? "destination-crashed" : partitioned ? "partitioned" : "random-loss";
    return {
      state: {
        ...state,
        messages: {
          ...state.messages,
          [timer.messageId]: { ...message, status: "dropped" },
        },
      },
      events: [messageDroppedEvent(NETWORKING_MODULE_ID, { messageId: timer.messageId, reason })],
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

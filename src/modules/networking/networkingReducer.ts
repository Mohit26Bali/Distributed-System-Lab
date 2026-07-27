import { messageSentEvent } from "../../simulation/events/networkEvents";
import type { ReduceContext, ReduceResult } from "../../simulation/engine/types";
import type { Message } from "../../simulation/models/Message";
import { NETWORKING_MODULE_ID } from "./constants";
import type { DeliverMessageTimerPayload } from "./networkingBehaviors";
import type { NetworkingState } from "./networkingState";

export type NetworkingAction = { type: "SEND_PING"; from: string; to: string };

export function reduceNetworking(
  state: NetworkingState,
  action: NetworkingAction,
  ctx: ReduceContext,
): ReduceResult<NetworkingState> {
  switch (action.type) {
    case "SEND_PING": {
      const latency = ctx.network.getLatency(action.from, action.to);
      const messageId = `msg-${state.nextMessageId}`;
      const deliveredTick = ctx.tick + latency;

      const message: Message = {
        id: messageId,
        from: action.from,
        to: action.to,
        sentTick: ctx.tick,
        deliveredTick,
        status: "in-flight",
        payload: {},
      };

      const timerPayload: DeliverMessageTimerPayload = { type: "DELIVER_MESSAGE", messageId };

      return {
        state: {
          ...state,
          nextMessageId: state.nextMessageId + 1,
          messages: { ...state.messages, [messageId]: message },
        },
        events: [
          messageSentEvent(NETWORKING_MODULE_ID, {
            messageId,
            from: action.from,
            to: action.to,
            sentTick: ctx.tick,
            deliveredTick,
          }),
        ],
        schedule: [{ dueTick: deliveredTick, payload: timerPayload }],
      };
    }
  }
}

import { messageDroppedEvent, messageSentEvent } from "../../simulation/events/networkEvents";
import { nodeCrashedEvent } from "../../simulation/events/nodeEvents";
import type { ReduceContext, ReduceResult } from "../../simulation/engine/types";
import type { Message } from "../../simulation/models/Message";
import { NETWORKING_MODULE_ID } from "./constants";
import type { DeliverMessageTimerPayload } from "./networkingBehaviors";
import type { NetworkingState } from "./networkingState";

export type NetworkingAction =
  | { type: "SEND_PING"; from: string; to: string }
  | { type: "KILL_NODE"; nodeId: string }
  | { type: "DROP_MESSAGE"; messageId: string };

const NO_OP = <State>(state: State): ReduceResult<State> => ({ state, events: [] });

export function reduceNetworking(
  state: NetworkingState,
  action: NetworkingAction,
  ctx: ReduceContext,
): ReduceResult<NetworkingState> {
  switch (action.type) {
    case "SEND_PING": {
      // A crashed node cannot originate a message — rejected, not a new event.
      const sourceNode = state.nodes[action.from];
      if (!sourceNode || sourceNode.status === "crashed") {
        return NO_OP(state);
      }

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

    case "KILL_NODE": {
      const node = state.nodes[action.nodeId];
      if (!node || node.status === "crashed") {
        return NO_OP(state); // already dead — nothing happened
      }

      return {
        state: {
          ...state,
          nodes: { ...state.nodes, [action.nodeId]: { ...node, status: "crashed" } },
        },
        events: [nodeCrashedEvent(NETWORKING_MODULE_ID, { nodeId: action.nodeId })],
      };
    }

    case "DROP_MESSAGE": {
      const message = state.messages[action.messageId];
      if (!message || message.status !== "in-flight") {
        return NO_OP(state); // unknown or already resolved — nothing happened
      }

      return {
        state: {
          ...state,
          messages: {
            ...state.messages,
            [action.messageId]: { ...message, status: "dropped" },
          },
        },
        events: [messageDroppedEvent(NETWORKING_MODULE_ID, { messageId: action.messageId })],
      };
    }
  }
}

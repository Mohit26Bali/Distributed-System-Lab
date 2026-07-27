import {
  messageDroppedEvent,
  messageDuplicatedEvent,
  messageReorderedEvent,
  messageSentEvent,
  networkConfigChangedEvent,
  partitionHealedEvent,
  partitionStartedEvent,
} from "../../simulation/events/networkEvents";
import { nodeCrashedEvent } from "../../simulation/events/nodeEvents";
import type { ReduceContext, ReduceResult } from "../../simulation/engine/types";
import type { Message } from "../../simulation/models/Message";
import { NETWORKING_MODULE_ID } from "./constants";
import type { DeliverMessageTimerPayload } from "./networkingBehaviors";
import type { NetworkingState } from "./networkingState";

export type NetworkingAction =
  | { type: "SEND_PING"; from: string; to: string }
  | { type: "KILL_NODE"; nodeId: string }
  | { type: "DROP_MESSAGE"; messageId: string }
  | { type: "SET_LINK_CONFIG"; from: string; to: string; latencyTicks?: number; dropRate?: number }
  | { type: "PARTITION_NETWORK"; groups: string[][] }
  | { type: "HEAL_PARTITION" }
  | { type: "REORDER_MESSAGE"; messageId: string; delayTicks: number }
  | { type: "DUPLICATE_MESSAGE"; messageId: string };

const NO_OP = <State>(state: State): ReduceResult<State> => ({ state, events: [] });

function scheduleDelivery(messageId: string, dueTick: number) {
  const timerPayload: DeliverMessageTimerPayload = { type: "DELIVER_MESSAGE", messageId };
  return { dueTick, payload: timerPayload };
}

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
        schedule: [scheduleDelivery(messageId, deliveredTick)],
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
        events: [
          messageDroppedEvent(NETWORKING_MODULE_ID, {
            messageId: action.messageId,
            reason: "manual",
          }),
        ],
      };
    }

    case "SET_LINK_CONFIG": {
      if (action.latencyTicks !== undefined && action.latencyTicks <= 0) {
        return NO_OP(state); // rejected: latency must be positive
      }
      if (action.dropRate !== undefined && (action.dropRate < 0 || action.dropRate > 1)) {
        return NO_OP(state); // rejected: not a valid probability
      }

      return {
        state,
        events: [
          networkConfigChangedEvent(NETWORKING_MODULE_ID, {
            from: action.from,
            to: action.to,
            latencyTicks: action.latencyTicks,
            dropRate: action.dropRate,
          }),
        ],
        networkPatch: {
          linkOverrides: [
            {
              from: action.from,
              to: action.to,
              latencyTicks: action.latencyTicks,
              dropRate: action.dropRate,
            },
          ],
        },
      };
    }

    case "PARTITION_NETWORK": {
      return {
        state,
        events: [partitionStartedEvent(NETWORKING_MODULE_ID, { groups: action.groups })],
        networkPatch: { partitionGroups: action.groups },
      };
    }

    case "HEAL_PARTITION": {
      return {
        state,
        events: [partitionHealedEvent(NETWORKING_MODULE_ID)],
        networkPatch: { partitionGroups: null },
      };
    }

    case "REORDER_MESSAGE": {
      const message = state.messages[action.messageId];
      if (!message || message.status !== "in-flight" || action.delayTicks <= 0) {
        return NO_OP(state);
      }

      const previousDeliveredTick = message.deliveredTick;
      const newDeliveredTick = previousDeliveredTick + action.delayTicks;

      return {
        state: {
          ...state,
          messages: {
            ...state.messages,
            [action.messageId]: { ...message, deliveredTick: newDeliveredTick },
          },
        },
        events: [
          messageReorderedEvent(NETWORKING_MODULE_ID, {
            messageId: action.messageId,
            previousDeliveredTick,
            newDeliveredTick,
          }),
        ],
        schedule: [scheduleDelivery(action.messageId, newDeliveredTick)],
      };
    }

    case "DUPLICATE_MESSAGE": {
      const original = state.messages[action.messageId];
      if (!original || original.status !== "in-flight") {
        return NO_OP(state);
      }

      const duplicateId = `${action.messageId}-dup-${state.nextMessageId}`;
      const duplicateMessage: Message = {
        id: duplicateId,
        from: original.from,
        to: original.to,
        sentTick: ctx.tick,
        deliveredTick: original.deliveredTick,
        status: "in-flight",
        payload: {},
      };

      return {
        state: {
          ...state,
          nextMessageId: state.nextMessageId + 1,
          messages: { ...state.messages, [duplicateId]: duplicateMessage },
        },
        events: [
          messageSentEvent(NETWORKING_MODULE_ID, {
            messageId: duplicateId,
            from: original.from,
            to: original.to,
            sentTick: ctx.tick,
            deliveredTick: original.deliveredTick,
          }),
          messageDuplicatedEvent(NETWORKING_MODULE_ID, {
            originalMessageId: action.messageId,
            duplicateMessageId: duplicateId,
          }),
        ],
        schedule: [scheduleDelivery(duplicateId, original.deliveredTick)],
      };
    }
  }
}

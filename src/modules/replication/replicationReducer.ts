import {
  messageDroppedEvent,
  messageDuplicatedEvent,
  messageReorderedEvent,
  networkConfigChangedEvent,
  partitionHealedEvent,
  partitionStartedEvent,
} from "../../simulation/events/networkEvents";
import { nodeCrashedEvent } from "../../simulation/events/nodeEvents";
import type { ReduceContext, ReduceResult, ScheduleRequest, SimEventDraft } from "../../simulation/engine/types";
import type { Message } from "../../simulation/models/Message";
import { REPLICATION_MODULE_ID } from "./constants";
import {
  readRequestedEvent,
  readServedEvent,
  replicationMessageSentEvent,
  writeAcceptedEvent,
  writeAcknowledgedEvent,
  type ConsistencyLevel,
  type ReplicationMessageKind,
  type ReplicationMode,
} from "./replicationEvents";
import { majorityOf, otherAliveNodeIds, type ReplicationState } from "./replicationState";

export type ReplicationAction =
  | { type: "SET_REPLICATION_MODE"; mode: ReplicationMode }
  | { type: "WRITE"; nodeId: string; key: string; value: string }
  | { type: "READ"; nodeId: string; key: string; consistency: ConsistencyLevel }
  | { type: "KILL_NODE"; nodeId: string }
  | { type: "SET_LINK_CONFIG"; from: string; to: string; latencyTicks?: number; dropRate?: number }
  | { type: "PARTITION_NETWORK"; groups: string[][] }
  | { type: "HEAL_PARTITION" }
  | { type: "DROP_MESSAGE"; messageId: string }
  | { type: "REORDER_MESSAGE"; messageId: string; delayTicks: number }
  | { type: "DUPLICATE_MESSAGE"; messageId: string };

export interface SendReplicationMessageOptions {
  mode?: ReplicationMode;
  found?: boolean;
  version?: number;
  requestId?: string;
  servedByNodeId?: string;
}

/**
 * Sends a replication message (any kind) from `from` to `to`, over the real
 * network transport — same MESSAGE_SENT event type, same NetworkModel
 * latency/drop-rate/partition handling every prior module has used.
 */
export function sendReplicationMessage(
  state: ReplicationState,
  ctx: ReduceContext,
  from: string,
  to: string,
  kind: ReplicationMessageKind,
  key: string,
  value: string,
  options: SendReplicationMessageOptions = {},
): { state: ReplicationState; events: SimEventDraft[]; schedule: ScheduleRequest[] } {
  const { mode, found, version, requestId, servedByNodeId } = options;
  const latency = ctx.network.getLatency(from, to);
  const messageId = `msg-${state.nextMessageId}`;
  const deliveredTick = ctx.tick + latency;
  const message: Message = {
    id: messageId,
    from,
    to,
    sentTick: ctx.tick,
    deliveredTick,
    status: "in-flight",
    payload: {
      kind,
      key,
      value,
      ...(mode ? { mode } : {}),
      ...(found !== undefined ? { found } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(requestId ? { requestId } : {}),
      ...(servedByNodeId ? { servedByNodeId } : {}),
    },
  };

  return {
    state: {
      ...state,
      nextMessageId: state.nextMessageId + 1,
      messages: { ...state.messages, [messageId]: message },
    },
    events: [
      replicationMessageSentEvent({
        messageId,
        from,
        to,
        sentTick: ctx.tick,
        deliveredTick,
        kind,
        key,
        value,
        mode,
        found,
        version,
        requestId,
        servedByNodeId,
      }),
    ],
    schedule: [{ dueTick: deliveredTick, payload: { type: "DELIVER_MESSAGE", messageId } }],
  };
}

export function reduceReplication(
  state: ReplicationState,
  action: ReplicationAction,
  ctx: ReduceContext,
): ReduceResult<ReplicationState> {
  switch (action.type) {
    case "SET_REPLICATION_MODE": {
      return { state: { ...state, mode: action.mode }, events: [] };
    }

    case "WRITE": {
      const node = state.nodes[action.nodeId];
      if (!node || node.role !== "leader" || node.status === "crashed") {
        // Only the leader can accept writes — same no-op precedent every
        // prior module uses for a rejected/invalid command.
        return { state, events: [] };
      }

      const version = (state.writeVersions[action.key] ?? 0) + 1;
      const withStore: ReplicationState = {
        ...state,
        nodes: {
          ...state.nodes,
          [action.nodeId]: { ...node, store: { ...node.store, [action.key]: action.value } },
        },
        writeVersions: { ...state.writeVersions, [action.key]: version },
        storeVersions: {
          ...state.storeVersions,
          [action.nodeId]: { ...state.storeVersions[action.nodeId], [action.key]: version },
        },
      };
      const events: SimEventDraft[] = [
        writeAcceptedEvent({ nodeId: action.nodeId, key: action.key, value: action.value, mode: state.mode, version }),
      ];

      const followers = otherAliveNodeIds(withStore, action.nodeId);
      let nextState = withStore;
      let sendEvents: SimEventDraft[] = [];
      let schedule: ScheduleRequest[] = [];
      for (const followerId of followers) {
        const sent = sendReplicationMessage(nextState, ctx, action.nodeId, followerId, "replicate", action.key, action.value, {
          mode: state.mode,
          version,
        });
        nextState = sent.state;
        sendEvents = [...sendEvents, ...sent.events];
        schedule = [...schedule, ...sent.schedule];
      }

      if (state.mode === "async") {
        // Acknowledged the instant the leader accepts it — before any
        // follower has necessarily received anything yet.
        events.push(writeAcknowledgedEvent({ key: action.key, value: action.value }));
        return { state: nextState, events: [...events, ...sendEvents], schedule };
      }

      if (state.mode === "quorum") {
        const required = majorityOf(Object.keys(nextState.nodes).length);
        if (1 >= required) {
          // The leader's own local write already is a majority (tiny
          // cluster) — nothing to wait for.
          events.push(writeAcknowledgedEvent({ key: action.key, value: action.value }));
          return { state: nextState, events: [...events, ...sendEvents], schedule };
        }

        const finalState: ReplicationState = {
          ...nextState,
          pendingQuorumWrites: {
            ...nextState.pendingQuorumWrites,
            [action.key]: { key: action.key, value: action.value, ackedBy: [], required },
          },
        };
        return { state: finalState, events: [...events, ...sendEvents], schedule };
      }

      // Sync: wait for every currently-alive follower to replicate-ack.
      // If there are none, there's nothing to wait for — acknowledge now.
      if (followers.length === 0) {
        events.push(writeAcknowledgedEvent({ key: action.key, value: action.value }));
        return { state: nextState, events: [...events, ...sendEvents], schedule };
      }

      const finalState: ReplicationState = {
        ...nextState,
        pendingSyncWrites: {
          ...nextState.pendingSyncWrites,
          [action.key]: { key: action.key, value: action.value, awaiting: followers },
        },
      };
      return { state: finalState, events: [...events, ...sendEvents], schedule };
    }

    case "READ": {
      const node = state.nodes[action.nodeId];
      if (!node || node.status === "crashed") {
        // Can't ask a dead/nonexistent node anything — same no-op
        // precedent as WRITE against a non-leader/crashed node.
        return { state, events: [] };
      }

      const events: SimEventDraft[] = [
        readRequestedEvent({ nodeId: action.nodeId, key: action.key, consistency: action.consistency }),
      ];

      if (action.consistency === "eventual" || node.role === "leader") {
        // Eventual reads always answer from local state. A strong or
        // quorum read targeting the leader needs no round trip either —
        // the leader's own store is already authoritative.
        const value = node.store[action.key];
        const found = value !== undefined;
        events.push(
          readServedEvent({
            nodeId: action.nodeId,
            key: action.key,
            value,
            found,
            consistency: action.consistency,
            servedByNodeId: action.nodeId,
            version: state.storeVersions[action.nodeId]?.[action.key] ?? 0,
          }),
        );
        return { state, events };
      }

      if (action.consistency === "strong") {
        // Strong read on a follower: forward to the leader. If the leader
        // is unreachable, the request just never resolves — same
        // no-timeout precedent as a sync write awaiting a dead follower.
        const leader = Object.values(state.nodes).find((n) => n.role === "leader");
        if (!leader || leader.status === "crashed") {
          return { state, events };
        }

        const sent = sendReplicationMessage(state, ctx, action.nodeId, leader.id, "read-forward", action.key, "");
        return { state: sent.state, events: [...events, ...sent.events], schedule: sent.schedule };
      }

      // Quorum read on a follower: this star topology only gives the
      // leader direct links to every node, so a follower can't fan out to
      // its peers itself. Instead it asks the leader to COORDINATE a
      // quorum read on its behalf — the follower's own local (value,
      // version) rides along on the request so the leader can count it
      // as one response without a wasted extra hop back to ask for it.
      // See docs/22-quorum-module-design.md's corrected coordinator-relay
      // design. Never resolves if the leader is unreachable — same
      // no-escape-hatch precedent as every other stuck request.
      const leader = Object.values(state.nodes).find((n) => n.role === "leader");
      if (!leader || leader.status === "crashed") {
        return { state, events };
      }

      const localVersion = state.storeVersions[action.nodeId]?.[action.key] ?? 0;
      const localValue = node.store[action.key];
      const localFound = localValue !== undefined;
      const sent = sendReplicationMessage(
        state,
        ctx,
        action.nodeId,
        leader.id,
        "quorum-coordinate-request",
        action.key,
        localFound ? localValue : "",
        { found: localFound, version: localVersion },
      );
      return { state: sent.state, events: [...events, ...sent.events], schedule: sent.schedule };
    }

    case "KILL_NODE": {
      const node = state.nodes[action.nodeId];
      if (!node || node.status === "crashed") {
        return { state, events: [] }; // already dead — nothing happened
      }

      return {
        state: {
          ...state,
          nodes: { ...state.nodes, [action.nodeId]: { ...node, status: "crashed" } },
        },
        events: [nodeCrashedEvent(REPLICATION_MODULE_ID, { nodeId: action.nodeId })],
      };
    }

    case "SET_LINK_CONFIG": {
      if (action.latencyTicks !== undefined && action.latencyTicks <= 0) {
        return { state, events: [] }; // rejected: latency must be positive
      }
      if (action.dropRate !== undefined && (action.dropRate < 0 || action.dropRate > 1)) {
        return { state, events: [] }; // rejected: not a valid probability
      }

      return {
        state,
        events: [
          networkConfigChangedEvent(REPLICATION_MODULE_ID, {
            from: action.from,
            to: action.to,
            latencyTicks: action.latencyTicks,
            dropRate: action.dropRate,
          }),
        ],
        networkPatch: {
          linkOverrides: [
            { from: action.from, to: action.to, latencyTicks: action.latencyTicks, dropRate: action.dropRate },
          ],
        },
      };
    }

    case "PARTITION_NETWORK": {
      return {
        state,
        events: [partitionStartedEvent(REPLICATION_MODULE_ID, { groups: action.groups })],
        networkPatch: { partitionGroups: action.groups },
      };
    }

    case "HEAL_PARTITION": {
      return {
        state,
        events: [partitionHealedEvent(REPLICATION_MODULE_ID)],
        networkPatch: { partitionGroups: null },
      };
    }

    case "DROP_MESSAGE": {
      const message = state.messages[action.messageId];
      if (!message || message.status !== "in-flight") {
        return { state, events: [] };
      }

      return {
        state: {
          ...state,
          messages: { ...state.messages, [action.messageId]: { ...message, status: "dropped" } },
        },
        events: [messageDroppedEvent(REPLICATION_MODULE_ID, { messageId: action.messageId, reason: "manual" })],
      };
    }

    case "REORDER_MESSAGE": {
      const message = state.messages[action.messageId];
      if (!message || message.status !== "in-flight" || action.delayTicks <= 0) {
        return { state, events: [] };
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
          messageReorderedEvent(REPLICATION_MODULE_ID, {
            messageId: action.messageId,
            previousDeliveredTick,
            newDeliveredTick,
          }),
        ],
        schedule: [{ dueTick: newDeliveredTick, payload: { type: "DELIVER_MESSAGE", messageId: action.messageId } }],
      };
    }

    case "DUPLICATE_MESSAGE": {
      const original = state.messages[action.messageId];
      if (!original || original.status !== "in-flight") {
        return { state, events: [] };
      }

      const duplicateId = `${action.messageId}-dup-${state.nextMessageId}`;
      const duplicateMessage: Message = {
        id: duplicateId,
        from: original.from,
        to: original.to,
        sentTick: ctx.tick,
        deliveredTick: original.deliveredTick,
        status: "in-flight",
        payload: original.payload,
      };
      const { kind, key, value, mode, found, version, requestId } = original.payload as {
        kind: ReplicationMessageKind;
        key: string;
        value: string;
        mode?: ReplicationMode;
        found?: boolean;
        version?: number;
        requestId?: string;
      };

      return {
        state: {
          ...state,
          nextMessageId: state.nextMessageId + 1,
          messages: { ...state.messages, [duplicateId]: duplicateMessage },
        },
        events: [
          replicationMessageSentEvent({
            messageId: duplicateId,
            from: original.from,
            to: original.to,
            sentTick: ctx.tick,
            deliveredTick: original.deliveredTick,
            kind,
            key,
            value,
            mode,
            found,
            version,
            requestId,
          }),
          messageDuplicatedEvent(REPLICATION_MODULE_ID, {
            originalMessageId: action.messageId,
            duplicateMessageId: duplicateId,
          }),
        ],
        schedule: [{ dueTick: original.deliveredTick, payload: { type: "DELIVER_MESSAGE", messageId: duplicateId } }],
      };
    }

    default:
      // See raftReducer.ts's identical default case: the store's shared
      // cross-module action union means a different module's action can
      // reach here at runtime. Defensive no-op rather than a crash.
      return { state, events: [] };
  }
}

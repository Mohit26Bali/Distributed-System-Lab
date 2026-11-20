import {
  networkConfigChangedEvent,
  partitionHealedEvent,
  partitionStartedEvent,
} from "../../simulation/events/networkEvents";
import { nodeCrashedEvent } from "../../simulation/events/nodeEvents";
import type { ReduceContext, ReduceResult, ScheduleRequest, SimEventDraft } from "../../simulation/engine/types";
import type { Message } from "../../simulation/models/Message";
import { ELECTION_MODULE_ID } from "./constants";
import {
  electionMessageSentEvent,
  electionStartedEvent,
  leaderElectedEvent,
  nodeRoleChangedEvent,
  type ElectionMessageKind,
  type ElectionStartedPayload,
} from "./electionEvents";
import { priorityOf, type ElectionState } from "./electionState";

export type ElectionAction =
  | { type: "START_ELECTION"; nodeId: string }
  | { type: "KILL_NODE"; nodeId: string }
  | { type: "SET_LINK_CONFIG"; from: string; to: string; latencyTicks?: number; dropRate?: number }
  | { type: "PARTITION_NETWORK"; groups: string[][] }
  | { type: "HEAL_PARTITION" };

/** Ticks a candidate waits for a first OK before self-declaring. */
export const ELECTION_TIMEOUT_TICKS = 8;
/** Ticks a candidate waits for a COORDINATOR after its first OK before restarting. */
export const COORDINATOR_TIMEOUT_TICKS = 10;

/** Every alive node with strictly higher priority than `nodeId`. */
function higherAliveNodeIds(state: ElectionState, nodeId: string): string[] {
  const priority = priorityOf(nodeId);
  return Object.values(state.nodes)
    .filter((n) => n.status === "alive" && n.id !== nodeId && priorityOf(n.id) > priority)
    .map((n) => n.id);
}

/** Every other alive node, regardless of priority (used for COORDINATOR broadcast). */
function otherAliveNodeIds(state: ElectionState, nodeId: string): string[] {
  return Object.values(state.nodes)
    .filter((n) => n.status === "alive" && n.id !== nodeId)
    .map((n) => n.id);
}

/**
 * Sends `kind` from `from` to every id in `targets`, over the real network
 * transport (same MESSAGE_SENT event type, same latency/drop-rate/partition
 * handling as Module 1 — see docs/10-election-module-design.md). Exported
 * so electionBehaviors.ts can send a single-target OK reply the same way.
 */
export function broadcast(
  state: ElectionState,
  ctx: ReduceContext,
  from: string,
  targets: string[],
  kind: ElectionMessageKind,
): { state: ElectionState; events: SimEventDraft[]; schedule: ScheduleRequest[] } {
  let nextState = state;
  const events: SimEventDraft[] = [];
  const schedule: ScheduleRequest[] = [];

  for (const to of targets) {
    const latency = ctx.network.getLatency(from, to);
    const messageId = `msg-${nextState.nextMessageId}`;
    const deliveredTick = ctx.tick + latency;
    const message: Message = {
      id: messageId,
      from,
      to,
      sentTick: ctx.tick,
      deliveredTick,
      status: "in-flight",
      payload: { kind },
    };

    nextState = {
      ...nextState,
      nextMessageId: nextState.nextMessageId + 1,
      messages: { ...nextState.messages, [messageId]: message },
    };
    events.push(
      electionMessageSentEvent({ messageId, from, to, sentTick: ctx.tick, deliveredTick, kind }),
    );
    schedule.push({ dueTick: deliveredTick, payload: { type: "DELIVER_MESSAGE", messageId } });
  }

  return { state: nextState, events, schedule };
}

/** A node with nobody left to outrank it: declare leadership and announce it. */
export function declareLeader(
  state: ElectionState,
  ctx: ReduceContext,
  nodeId: string,
): ReduceResult<ElectionState> {
  const withRole: ElectionState = {
    ...state,
    nodes: { ...state.nodes, [nodeId]: { ...state.nodes[nodeId], role: "leader", awaitingCoordinator: false } },
  };

  const { state: finalState, events, schedule } = broadcast(
    withRole,
    ctx,
    nodeId,
    otherAliveNodeIds(withRole, nodeId),
    "coordinator",
  );

  return {
    state: finalState,
    events: [nodeRoleChangedEvent({ nodeId, role: "leader" }), leaderElectedEvent({ nodeId }), ...events],
    schedule,
  };
}

/**
 * Shared entry point for every way an election can begin: a manual command,
 * a node bubbling up in reaction to a received ELECTION message, or a
 * candidate restarting after its COORDINATOR_TIMEOUT fires. Only emits
 * NODE_ROLE_CHANGED if the node wasn't already a candidate, consistent with
 * that event only ever representing a real transition (see Milestone 15's
 * COORDINATOR-delivery bug).
 */
export function beginElection(
  state: ElectionState,
  ctx: ReduceContext,
  nodeId: string,
  reason: ElectionStartedPayload["reason"],
): ReduceResult<ElectionState> {
  const node = state.nodes[nodeId];
  const wasAlreadyCandidate = node.role === "candidate";

  const withCandidate: ElectionState = {
    ...state,
    nodes: { ...state.nodes, [nodeId]: { ...node, role: "candidate", awaitingCoordinator: false } },
  };

  const startEvents: SimEventDraft[] = [electionStartedEvent({ nodeId, reason })];
  if (!wasAlreadyCandidate) {
    startEvents.push(nodeRoleChangedEvent({ nodeId, role: "candidate" }));
  }

  const higher = higherAliveNodeIds(state, nodeId);

  if (higher.length === 0) {
    // Nobody outranks this node — no need to wait, it's already the winner.
    const result = declareLeader(withCandidate, ctx, nodeId);
    return { ...result, events: [...startEvents, ...result.events] };
  }

  const { state: finalState, events, schedule } = broadcast(withCandidate, ctx, nodeId, higher, "election");

  return {
    state: finalState,
    events: [...startEvents, ...events],
    schedule: [
      ...schedule,
      { dueTick: ctx.tick + ELECTION_TIMEOUT_TICKS, payload: { type: "ELECTION_TIMEOUT", nodeId } },
    ],
  };
}

export function reduceElection(
  state: ElectionState,
  action: ElectionAction,
  ctx: ReduceContext,
): ReduceResult<ElectionState> {
  switch (action.type) {
    case "START_ELECTION": {
      const node = state.nodes[action.nodeId];
      if (!node || node.status === "crashed") {
        return { state, events: [] }; // a crashed node can't start an election
      }
      return beginElection(state, ctx, action.nodeId, "manual");
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
        events: [nodeCrashedEvent(ELECTION_MODULE_ID, { nodeId: action.nodeId })],
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
          networkConfigChangedEvent(ELECTION_MODULE_ID, {
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
        events: [partitionStartedEvent(ELECTION_MODULE_ID, { groups: action.groups })],
        networkPatch: { partitionGroups: action.groups },
      };
    }

    case "HEAL_PARTITION": {
      return {
        state,
        events: [partitionHealedEvent(ELECTION_MODULE_ID)],
        networkPatch: { partitionGroups: null },
      };
    }

    default:
      // See networkingReducer.ts's identical default case: the store's
      // shared cross-module action union means a different module's action
      // can reach here at runtime. Defensive no-op rather than a crash.
      return { state, events: [] };
  }
}

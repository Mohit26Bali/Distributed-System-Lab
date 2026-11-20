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
import { RAFT_MODULE_ID } from "./constants";
import {
  electionStartedEvent,
  leaderElectedEvent,
  logEntryAppendedEvent,
  logEntryCommittedEvent,
  nodeRoleChangedEvent,
  raftMessageSentEvent,
  termChangedEvent,
  type ElectionStartedPayload,
  type RaftMessageKind,
} from "./raftEvents";
import { lastLogTermAndIndex, majorityOf, type LogEntry, type RaftState } from "./raftState";

export type RaftAction =
  | { type: "START_ELECTION"; nodeId: string }
  | { type: "SUBMIT_ENTRY"; nodeId: string; value: string }
  | { type: "KILL_NODE"; nodeId: string }
  | { type: "SET_LINK_CONFIG"; from: string; to: string; latencyTicks?: number; dropRate?: number }
  | { type: "PARTITION_NETWORK"; groups: string[][] }
  | { type: "HEAL_PARTITION" }
  | { type: "DROP_MESSAGE"; messageId: string }
  | { type: "REORDER_MESSAGE"; messageId: string; delayTicks: number }
  | { type: "DUPLICATE_MESSAGE"; messageId: string };

/**
 * Ticks between a leader's heartbeats — must stay well under the election
 * timeout range. The election timeout range itself must be wide relative to
 * round-trip latency (2x a link's one-way latency here): followers that
 * granted a vote around the same tick (the common case — one candidate's
 * request-vote broadcast reaches everyone at once) get their timeouts
 * scheduled at nearly the same tick too, so a narrow range makes repeated
 * split votes likely rather than a rare edge case. A span this wide relative
 * to latency was found necessary via an actual observed livelock (four
 * followers re-colliding on every retry with a 10-16 tick range against
 * 3-tick links) rather than assumed up front.
 */
export const HEARTBEAT_INTERVAL_TICKS = 4;
export const ELECTION_TIMEOUT_MIN_TICKS = 15;
export const ELECTION_TIMEOUT_MAX_TICKS = 45;

function randomElectionTimeoutDuration(ctx: ReduceContext): number {
  const span = ELECTION_TIMEOUT_MAX_TICKS - ELECTION_TIMEOUT_MIN_TICKS;
  return ELECTION_TIMEOUT_MIN_TICKS + Math.floor(ctx.random.next() * (span + 1));
}

/**
 * Schedules a fresh, randomized ELECTION_TIMEOUT for `nodeId` and bumps its
 * token so any previously scheduled one becomes stale. Called whenever a
 * node has reason to keep waiting: it just started/restarted a candidacy,
 * granted a vote, or heard a valid heartbeat.
 */
export function scheduleElectionTimeout(
  state: RaftState,
  ctx: ReduceContext,
  nodeId: string,
): { state: RaftState; schedule: ScheduleRequest[] } {
  const node = state.nodes[nodeId];
  const token = node.electionTimeoutToken + 1;
  const duration = randomElectionTimeoutDuration(ctx);
  return {
    state: { ...state, nodes: { ...state.nodes, [nodeId]: { ...node, electionTimeoutToken: token } } },
    schedule: [{ dueTick: ctx.tick + duration, payload: { type: "ELECTION_TIMEOUT", nodeId, token } }],
  };
}

/** Invalidates any pending election timeout without scheduling a new one — a leader doesn't need one. */
function invalidateElectionTimeout(state: RaftState, nodeId: string): RaftState {
  const node = state.nodes[nodeId];
  return {
    ...state,
    nodes: { ...state.nodes, [nodeId]: { ...node, electionTimeoutToken: node.electionTimeoutToken + 1 } },
  };
}

/** Every other alive node — Raft's messages target reachability, not priority. */
export function otherAliveNodeIds(state: RaftState, nodeId: string): string[] {
  return Object.values(state.nodes)
    .filter((n) => n.status === "alive" && n.id !== nodeId)
    .map((n) => n.id);
}

/**
 * Sends a Raft protocol message (any kind) from `from` to every id in
 * `targets`, over the real network transport — same MESSAGE_SENT event
 * type, same NetworkModel latency/drop-rate/partition handling every prior
 * module has used. `extra` carries whatever fields this message kind needs
 * beyond the transport envelope (term, candidateId, entries, etc.).
 */
export function broadcastRaftMessage(
  state: RaftState,
  ctx: ReduceContext,
  from: string,
  targets: string[],
  kind: RaftMessageKind,
  extra: Record<string, unknown>,
): { state: RaftState; events: SimEventDraft[]; schedule: ScheduleRequest[] } {
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
      payload: { kind, ...extra },
    };

    nextState = {
      ...nextState,
      nextMessageId: nextState.nextMessageId + 1,
      messages: { ...nextState.messages, [messageId]: message },
    };
    events.push(
      raftMessageSentEvent({ messageId, from, to, sentTick: ctx.tick, deliveredTick, kind, ...extra }),
    );
    schedule.push({ dueTick: deliveredTick, payload: { type: "DELIVER_MESSAGE", messageId } });
  }

  return { state: nextState, events, schedule };
}

/**
 * A candidate that holds a majority becomes leader: initializes the
 * leader-only nextIndex/matchIndex bookkeeping for every OTHER node in the
 * whole cluster (not just currently-alive ones), invalidates any pending
 * election timeout (a leader doesn't need one), and schedules its first
 * recurring heartbeat.
 */
export function becomeLeader(state: RaftState, ctx: ReduceContext, nodeId: string): ReduceResult<RaftState> {
  const node = state.nodes[nodeId];
  const nextIndex: Record<string, number> = {};
  const matchIndex: Record<string, number> = {};
  for (const id of Object.keys(state.nodes)) {
    if (id === nodeId) continue;
    nextIndex[id] = node.log.length;
    // -1, not 0: nothing is confirmed replicated to this follower yet —
    // same 0-based "nothing yet" sentinel as commitIndex.
    matchIndex[id] = -1;
  }

  const leaderNode = { ...node, role: "leader" as const, nextIndex, matchIndex, votesReceived: [] };
  const withLeader = invalidateElectionTimeout(
    { ...state, nodes: { ...state.nodes, [nodeId]: leaderNode } },
    nodeId,
  );

  return {
    state: withLeader,
    events: [
      nodeRoleChangedEvent({ nodeId, role: "leader" }),
      leaderElectedEvent({ nodeId, term: node.currentTerm }),
    ],
    schedule: [{ dueTick: ctx.tick + HEARTBEAT_INTERVAL_TICKS, payload: { type: "HEARTBEAT_TIMER", nodeId } }],
  };
}

/**
 * Shared entry point for every way an election can begin: a manual
 * bootstrap command, or an automatic promotion/restart on ELECTION_TIMEOUT
 * (Milestone 21). Always increments term, votes for self, requests votes
 * from every other alive node, and schedules this node's own timeout for
 * the new candidacy (in case it doesn't reach a majority either).
 */
export function startElection(
  state: RaftState,
  ctx: ReduceContext,
  nodeId: string,
  reason: ElectionStartedPayload["reason"],
): ReduceResult<RaftState> {
  const node = state.nodes[nodeId];
  const term = node.currentTerm + 1;
  const candidateNode = {
    ...node,
    role: "candidate" as const,
    currentTerm: term,
    votedFor: nodeId,
    votesReceived: [nodeId],
    nextIndex: null,
    matchIndex: null,
  };
  const withCandidate: RaftState = { ...state, nodes: { ...state.nodes, [nodeId]: candidateNode } };

  const startEvents: SimEventDraft[] = [
    electionStartedEvent({ nodeId, term, reason }),
    termChangedEvent({ nodeId, term }),
    nodeRoleChangedEvent({ nodeId, role: "candidate" }),
  ];

  const clusterSize = Object.keys(state.nodes).length;
  if (majorityOf(clusterSize) <= 1) {
    // A cluster of 1 — its own vote is already a majority.
    const result = becomeLeader(withCandidate, ctx, nodeId);
    return { ...result, events: [...startEvents, ...result.events] };
  }

  const others = otherAliveNodeIds(withCandidate, nodeId);
  const { term: lastLogTerm, index: lastLogIndex } = lastLogTermAndIndex(node.log);

  const { state: afterSend, events, schedule: sendSchedule } = broadcastRaftMessage(
    withCandidate,
    ctx,
    nodeId,
    others,
    "request-vote",
    { term, candidateId: nodeId, lastLogIndex, lastLogTerm },
  );

  const { state: finalState, schedule: timeoutSchedule } = scheduleElectionTimeout(afterSend, ctx, nodeId);

  return {
    state: finalState,
    events: [...startEvents, ...events],
    schedule: [...sendSchedule, ...timeoutSchedule],
  };
}

/**
 * The AppendEntries payload a leader owes a specific follower right now:
 * everything from that follower's own nextIndex onward, plus enough of the
 * preceding entry (prevLogIndex/prevLogTerm) for the follower to run Raft's
 * log-consistency check. Used both for real replication (SUBMIT_ENTRY) and
 * for the leader's periodic heartbeat — a heartbeat is just an AppendEntries
 * whose follower happens to already be caught up (entries: []).
 */
export function buildAppendEntriesPayload(
  state: RaftState,
  leaderId: string,
  followerId: string,
): Record<string, unknown> {
  const leader = state.nodes[leaderId];
  const nextIdx = leader.nextIndex?.[followerId] ?? leader.log.length;
  const prevLogIndex = nextIdx - 1;
  const prevEntry = prevLogIndex >= 0 ? leader.log[prevLogIndex] : undefined;
  const prevLogTerm = prevEntry ? prevEntry.term : 0;
  const entries = leader.log.slice(nextIdx);
  return {
    term: leader.currentTerm,
    leaderId,
    prevLogIndex,
    prevLogTerm,
    entries,
    leaderCommit: leader.commitIndex,
  };
}

/**
 * Recomputes a leader's commitIndex: the highest log index replicated to a
 * majority (leader included) whose entry's term equals the leader's CURRENT
 * term — never committing an older-term entry by count alone, per Raft's
 * core safety rule (docs/12-raft-module-design.md). Scanning from the top
 * down and stopping at the first index that qualifies is safe: matchIndex
 * is monotonic, so anything replicated to index N is replicated to every
 * index below it too.
 */
export function tryAdvanceCommitIndex(
  state: RaftState,
  leaderId: string,
): { state: RaftState; events: SimEventDraft[] } {
  const leader = state.nodes[leaderId];
  if (leader.role !== "leader" || !leader.matchIndex) {
    return { state, events: [] };
  }

  const clusterSize = Object.keys(state.nodes).length;
  const majority = majorityOf(clusterSize);
  const matchIndices = [leader.log.length - 1, ...Object.values(leader.matchIndex)];

  let newCommitIndex = leader.commitIndex;
  for (let index = leader.log.length - 1; index > leader.commitIndex; index--) {
    if (leader.log[index].term !== leader.currentTerm) continue;
    const replicatedCount = matchIndices.filter((m) => m >= index).length;
    if (replicatedCount >= majority) {
      newCommitIndex = index;
      break;
    }
  }

  if (newCommitIndex === leader.commitIndex) {
    return { state, events: [] };
  }

  const events: SimEventDraft[] = [];
  for (let index = leader.commitIndex + 1; index <= newCommitIndex; index++) {
    events.push(logEntryCommittedEvent({ nodeId: leaderId, index, term: leader.log[index].term }));
  }

  return {
    state: { ...state, nodes: { ...state.nodes, [leaderId]: { ...leader, commitIndex: newCommitIndex } } },
    events,
  };
}

export function reduceRaft(state: RaftState, action: RaftAction, ctx: ReduceContext): ReduceResult<RaftState> {
  switch (action.type) {
    case "START_ELECTION": {
      const node = state.nodes[action.nodeId];
      if (!node || node.status === "crashed") {
        return { state, events: [] }; // a crashed node can't start an election
      }
      return startElection(state, ctx, action.nodeId, "manual");
    }

    case "SUBMIT_ENTRY": {
      const node = state.nodes[action.nodeId];
      if (!node || node.role !== "leader" || node.status === "crashed") {
        // Only the leader can accept writes — same no-op precedent as any
        // other rejected/invalid command (e.g. SET_LINK_CONFIG's validation).
        return { state, events: [] };
      }

      const entry: LogEntry = { term: node.currentTerm, index: node.log.length, value: action.value };
      const withEntry: RaftState = {
        ...state,
        nodes: { ...state.nodes, [action.nodeId]: { ...node, log: [...node.log, entry] } },
      };
      const events: SimEventDraft[] = [
        logEntryAppendedEvent({ nodeId: action.nodeId, index: entry.index, term: entry.term, value: entry.value }),
      ];

      // Replicate immediately rather than waiting for the next heartbeat.
      let nextState = withEntry;
      let sendEvents: SimEventDraft[] = [];
      let schedule: ScheduleRequest[] = [];
      for (const followerId of otherAliveNodeIds(withEntry, action.nodeId)) {
        const payload = buildAppendEntriesPayload(nextState, action.nodeId, followerId);
        const sent = broadcastRaftMessage(nextState, ctx, action.nodeId, [followerId], "append-entries", payload);
        nextState = sent.state;
        sendEvents = [...sendEvents, ...sent.events];
        schedule = [...schedule, ...sent.schedule];
      }

      // A single-node cluster commits its own write immediately — there's
      // no one else to replicate to, and the leader's own log already
      // constitutes a majority.
      const { state: finalState, events: commitEvents } = tryAdvanceCommitIndex(nextState, action.nodeId);

      return { state: finalState, events: [...events, ...sendEvents, ...commitEvents], schedule };
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
        events: [nodeCrashedEvent(RAFT_MODULE_ID, { nodeId: action.nodeId })],
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
          networkConfigChangedEvent(RAFT_MODULE_ID, {
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
        events: [partitionStartedEvent(RAFT_MODULE_ID, { groups: action.groups })],
        networkPatch: { partitionGroups: action.groups },
      };
    }

    case "HEAL_PARTITION": {
      return {
        state,
        events: [partitionHealedEvent(RAFT_MODULE_ID)],
        networkPatch: { partitionGroups: null },
      };
    }

    case "DROP_MESSAGE": {
      const message = state.messages[action.messageId];
      if (!message || message.status !== "in-flight") {
        return { state, events: [] }; // unknown or already resolved — nothing happened
      }

      return {
        state: {
          ...state,
          messages: { ...state.messages, [action.messageId]: { ...message, status: "dropped" } },
        },
        events: [messageDroppedEvent(RAFT_MODULE_ID, { messageId: action.messageId, reason: "manual" })],
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
          messageReorderedEvent(RAFT_MODULE_ID, {
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

      return {
        state: {
          ...state,
          nextMessageId: state.nextMessageId + 1,
          messages: { ...state.messages, [duplicateId]: duplicateMessage },
        },
        events: [
          raftMessageSentEvent({
            messageId: duplicateId,
            from: original.from,
            to: original.to,
            sentTick: ctx.tick,
            deliveredTick: original.deliveredTick,
            ...(original.payload as { kind: RaftMessageKind }),
          }),
          messageDuplicatedEvent(RAFT_MODULE_ID, {
            originalMessageId: action.messageId,
            duplicateMessageId: duplicateId,
          }),
        ],
        schedule: [{ dueTick: original.deliveredTick, payload: { type: "DELIVER_MESSAGE", messageId: duplicateId } }],
      };
    }

    default:
      // See networkingReducer.ts's identical default case: the store's
      // shared cross-module action union means a different module's action
      // can reach here at runtime. Defensive no-op rather than a crash.
      return { state, events: [] };
  }
}

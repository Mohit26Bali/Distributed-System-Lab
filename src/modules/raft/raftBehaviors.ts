import { messageDeliveredEvent, messageDroppedEvent } from "../../simulation/events/networkEvents";
import type { ReduceContext, ReduceResult, ScheduleRequest, SimEventDraft } from "../../simulation/engine/types";
import { RAFT_MODULE_ID } from "./constants";
import {
  logEntryAppendedEvent,
  logEntryCommittedEvent,
  nodeRoleChangedEvent,
  termChangedEvent,
  voteGrantedEvent,
  type RaftMessageKind,
} from "./raftEvents";
import {
  becomeLeader,
  broadcastRaftMessage,
  buildAppendEntriesPayload,
  otherAliveNodeIds,
  scheduleElectionTimeout,
  startElection,
  tryAdvanceCommitIndex,
  HEARTBEAT_INTERVAL_TICKS,
} from "./raftReducer";
import { isLogAtLeastAsUpToDate, majorityOf, type LogEntry, type RaftState } from "./raftState";
import type { RaftTimerPayload } from "./raftTimers";

interface RequestVotePayload {
  kind: "request-vote";
  term: number;
  candidateId: string;
  lastLogIndex: number;
  lastLogTerm: number;
}

interface VoteResponsePayload {
  kind: "vote-response";
  term: number;
  voterId: string;
  granted: boolean;
}

interface AppendEntriesPayload {
  kind: "append-entries";
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
}

interface AppendResponsePayload {
  kind: "append-response";
  term: number;
  followerId: string;
  success: boolean;
  matchIndex: number;
}

type RaftMessagePayload = { kind: RaftMessageKind } & Record<string, unknown>;

/**
 * Handles every timer kind this module schedules:
 *
 * 1. `DELIVER_MESSAGE`: same stale/destination-crashed/partitioned/
 *    random-loss rules every prior module's transport uses. On success,
 *    dispatches by message kind (vote request/response, heartbeat).
 * 2. `ELECTION_TIMEOUT`: a node that hasn't heard from a leader (or reached
 *    a majority as candidate) within its randomized window promotes/
 *    restarts automatically. Stale (no-op) if its token no longer matches
 *    — a heartbeat, a granted vote, or becoming leader has since
 *    superseded it.
 * 3. `HEARTBEAT_TIMER`: a leader's recurring self-announcement. Stops
 *    rescheduling itself the moment this node is no longer leader.
 */
export function onRaftTimer(state: RaftState, payload: unknown, ctx: ReduceContext): ReduceResult<RaftState> {
  const timer = payload as RaftTimerPayload;

  if (timer.type === "ELECTION_TIMEOUT") {
    const node = state.nodes[timer.nodeId];
    if (!node || node.status === "crashed" || node.role === "leader" || node.electionTimeoutToken !== timer.token) {
      return { state, events: [] }; // stale or irrelevant
    }
    return startElection(state, ctx, timer.nodeId, "election-timeout");
  }

  if (timer.type === "HEARTBEAT_TIMER") {
    const node = state.nodes[timer.nodeId];
    if (!node || node.role !== "leader" || node.status === "crashed") {
      return { state, events: [] }; // stepped down or crashed — the chain stops here
    }

    // Each follower gets whatever it's actually owed (its own nextIndex
    // onward) — a heartbeat is just an AppendEntries a caught-up follower
    // happens to receive with entries: [].
    let nextState = state;
    let events: SimEventDraft[] = [];
    let schedule: ScheduleRequest[] = [];
    for (const followerId of otherAliveNodeIds(state, timer.nodeId)) {
      const payload = buildAppendEntriesPayload(nextState, timer.nodeId, followerId);
      const sent = broadcastRaftMessage(nextState, ctx, timer.nodeId, [followerId], "append-entries", payload);
      nextState = sent.state;
      events = [...events, ...sent.events];
      schedule = [...schedule, ...sent.schedule];
    }

    return {
      state: nextState,
      events,
      schedule: [
        ...schedule,
        { dueTick: ctx.tick + HEARTBEAT_INTERVAL_TICKS, payload: { type: "HEARTBEAT_TIMER", nodeId: timer.nodeId } },
      ],
    };
  }

  const message = state.messages[timer.messageId];
  if (!message || message.status !== "in-flight") {
    return { state, events: [] };
  }
  if (message.deliveredTick !== ctx.tick) {
    return { state, events: [] }; // stale: reordered to a different tick, same as networking's onTimer
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
        messages: { ...state.messages, [timer.messageId]: { ...message, status: "dropped" } },
      },
      events: [messageDroppedEvent(RAFT_MODULE_ID, { messageId: timer.messageId, reason })],
    };
  }

  const deliveredState: RaftState = {
    ...state,
    messages: { ...state.messages, [timer.messageId]: { ...message, status: "delivered" } },
  };
  const events = [messageDeliveredEvent(RAFT_MODULE_ID, { messageId: timer.messageId })];
  const payloadData = message.payload as RaftMessagePayload;
  const node = deliveredState.nodes[message.to];

  if (!node) {
    return { state: deliveredState, events };
  }

  if (payloadData.kind === "request-vote") {
    return handleRequestVote(deliveredState, ctx, node.id, payloadData as unknown as RequestVotePayload, events);
  }

  if (payloadData.kind === "vote-response") {
    return handleVoteResponse(deliveredState, ctx, node.id, payloadData as unknown as VoteResponsePayload, events);
  }

  if (payloadData.kind === "append-entries") {
    return handleAppendEntries(deliveredState, ctx, node.id, payloadData as unknown as AppendEntriesPayload, events);
  }

  return handleAppendResponse(deliveredState, ctx, node.id, payloadData as unknown as AppendResponsePayload, events);
}

function handleRequestVote(
  state: RaftState,
  ctx: ReduceContext,
  voterId: string,
  request: RequestVotePayload,
  baseEvents: SimEventDraft[],
): ReduceResult<RaftState> {
  const voter = state.nodes[voterId];
  const events = [...baseEvents];
  let nextVoter = voter;

  if (request.term > voter.currentTerm) {
    const wasNonFollower = voter.role !== "follower";
    nextVoter = {
      ...voter,
      currentTerm: request.term,
      votedFor: null,
      role: "follower",
      votesReceived: [],
      nextIndex: null,
      matchIndex: null,
    };
    events.push(termChangedEvent({ nodeId: voterId, term: request.term }));
    if (wasNonFollower) {
      events.push(nodeRoleChangedEvent({ nodeId: voterId, role: "follower" }));
    }
  }

  let granted = false;
  if (request.term >= nextVoter.currentTerm) {
    const votedForSomeoneElse = nextVoter.votedFor !== null && nextVoter.votedFor !== request.candidateId;
    if (!votedForSomeoneElse) {
      granted = isLogAtLeastAsUpToDate(request.lastLogTerm, request.lastLogIndex, nextVoter.log);
    }
  }

  let stateWithVoter: RaftState = { ...state, nodes: { ...state.nodes, [voterId]: nextVoter } };
  let timeoutSchedule: ReturnType<typeof scheduleElectionTimeout>["schedule"] = [];

  if (granted) {
    nextVoter = { ...nextVoter, votedFor: request.candidateId };
    stateWithVoter = { ...stateWithVoter, nodes: { ...stateWithVoter.nodes, [voterId]: nextVoter } };
    events.push(voteGrantedEvent({ candidateId: request.candidateId, voterId, term: nextVoter.currentTerm }));
    // Granting a vote gives that candidate a fair shot before this node
    // competes or times out again.
    const timeoutResult = scheduleElectionTimeout(stateWithVoter, ctx, voterId);
    stateWithVoter = timeoutResult.state;
    timeoutSchedule = timeoutResult.schedule;
  }

  const reply = broadcastRaftMessage(stateWithVoter, ctx, voterId, [request.candidateId], "vote-response", {
    term: nextVoter.currentTerm,
    voterId,
    granted,
  });

  return {
    state: reply.state,
    events: [...events, ...reply.events],
    schedule: [...timeoutSchedule, ...reply.schedule],
  };
}

function handleVoteResponse(
  state: RaftState,
  ctx: ReduceContext,
  candidateId: string,
  response: VoteResponsePayload,
  baseEvents: SimEventDraft[],
): ReduceResult<RaftState> {
  const candidate = state.nodes[candidateId];

  if (response.term > candidate.currentTerm) {
    const steppedDown = {
      ...candidate,
      currentTerm: response.term,
      role: "follower" as const,
      votedFor: null,
      votesReceived: [],
      nextIndex: null,
      matchIndex: null,
    };
    const { state: withNode, schedule } = scheduleElectionTimeout(
      { ...state, nodes: { ...state.nodes, [candidateId]: steppedDown } },
      ctx,
      candidateId,
    );
    return {
      state: withNode,
      events: [
        ...baseEvents,
        termChangedEvent({ nodeId: candidateId, term: response.term }),
        nodeRoleChangedEvent({ nodeId: candidateId, role: "follower" }),
      ],
      schedule,
    };
  }

  const isStaleOrIrrelevant =
    candidate.role !== "candidate" || response.term !== candidate.currentTerm || !response.granted;
  if (isStaleOrIrrelevant || candidate.votesReceived.includes(response.voterId)) {
    return { state, events: baseEvents };
  }

  const votesReceived = [...candidate.votesReceived, response.voterId];
  const withTally: RaftState = {
    ...state,
    nodes: { ...state.nodes, [candidateId]: { ...candidate, votesReceived } },
  };

  const clusterSize = Object.keys(state.nodes).length;
  if (votesReceived.length >= majorityOf(clusterSize)) {
    const result = becomeLeader(withTally, ctx, candidateId);
    return { ...result, events: [...baseEvents, ...result.events] };
  }

  return { state: withTally, events: baseEvents };
}

function handleAppendEntries(
  state: RaftState,
  ctx: ReduceContext,
  followerId: string,
  request: AppendEntriesPayload,
  baseEvents: SimEventDraft[],
): ReduceResult<RaftState> {
  const node = state.nodes[followerId];
  const lastLogIndex = node.log.length > 0 ? node.log[node.log.length - 1].index : -1;

  if (request.term < node.currentTerm) {
    // Stale leader — reject, no timeout reset (this isn't a legitimate leader).
    const reply = broadcastRaftMessage(state, ctx, followerId, [request.leaderId], "append-response", {
      term: node.currentTerm,
      followerId,
      success: false,
      matchIndex: lastLogIndex,
    });
    return { state: reply.state, events: [...baseEvents, ...reply.events], schedule: reply.schedule };
  }

  const events = [...baseEvents];
  const higherTerm = request.term > node.currentTerm;
  if (higherTerm) {
    events.push(termChangedEvent({ nodeId: followerId, term: request.term }));
  }
  const wasNonFollower = node.role !== "follower";
  const nextNode = {
    ...node,
    currentTerm: request.term,
    role: "follower" as const,
    ...(higherTerm ? { votedFor: null, votesReceived: [], nextIndex: null, matchIndex: null } : {}),
  };
  if (wasNonFollower) {
    events.push(nodeRoleChangedEvent({ nodeId: followerId, role: "follower" }));
  }

  const withNode: RaftState = { ...state, nodes: { ...state.nodes, [followerId]: nextNode } };
  const { state: withTimeout, schedule: timeoutSchedule } = scheduleElectionTimeout(withNode, ctx, followerId);

  // Raft's log-consistency check: the entry immediately before where the
  // new ones would go must already match (same term). No optimized
  // "conflict term" backtracking (docs/12-raft-module-design.md's stated
  // non-goal) — just reject and let the leader decrement nextIndex by one.
  const prevOk =
    request.prevLogIndex === -1 ||
    (nextNode.log[request.prevLogIndex] !== undefined &&
      nextNode.log[request.prevLogIndex].term === request.prevLogTerm);

  if (!prevOk) {
    const reply = broadcastRaftMessage(withTimeout, ctx, followerId, [request.leaderId], "append-response", {
      term: nextNode.currentTerm,
      followerId,
      success: false,
      matchIndex: lastLogIndex,
    });
    return {
      state: reply.state,
      events: [...events, ...reply.events],
      schedule: [...timeoutSchedule, ...reply.schedule],
    };
  }

  // Consistent as of prevLogIndex — truncate any conflicting tail and
  // append what the leader sent (the entries the leader sent already start
  // exactly at prevLogIndex + 1, so no further per-entry conflict check is
  // needed once the prev-entry check above has passed).
  const newLog = [...nextNode.log.slice(0, request.prevLogIndex + 1), ...request.entries];
  for (const entry of request.entries) {
    events.push(logEntryAppendedEvent({ nodeId: followerId, index: entry.index, term: entry.term, value: entry.value }));
  }

  const newLastLogIndex = newLog.length > 0 ? newLog[newLog.length - 1].index : -1;
  const newCommitIndex =
    request.leaderCommit > nextNode.commitIndex
      ? Math.min(request.leaderCommit, newLastLogIndex)
      : nextNode.commitIndex;

  // This follower's own commit progress, reported separately from the
  // leader's — a partitioned-away follower's never advances past
  // whatever it already had, exactly the signal the Distributed Database
  // capstone needs to show a stale read. See docs/24-distributed-
  // database-module-design.md.
  for (let index = nextNode.commitIndex + 1; index <= newCommitIndex; index++) {
    events.push(logEntryCommittedEvent({ nodeId: followerId, index, term: newLog[index].term }));
  }

  const withLog: RaftState = {
    ...withTimeout,
    nodes: {
      ...withTimeout.nodes,
      [followerId]: { ...withTimeout.nodes[followerId], log: newLog, commitIndex: newCommitIndex },
    },
  };

  const reply = broadcastRaftMessage(withLog, ctx, followerId, [request.leaderId], "append-response", {
    term: nextNode.currentTerm,
    followerId,
    success: true,
    matchIndex: newLastLogIndex,
  });

  return {
    state: reply.state,
    events: [...events, ...reply.events],
    schedule: [...timeoutSchedule, ...reply.schedule],
  };
}

function handleAppendResponse(
  state: RaftState,
  ctx: ReduceContext,
  leaderId: string,
  response: AppendResponsePayload,
  baseEvents: SimEventDraft[],
): ReduceResult<RaftState> {
  const leader = state.nodes[leaderId];

  if (response.term > leader.currentTerm) {
    const steppedDown = {
      ...leader,
      currentTerm: response.term,
      role: "follower" as const,
      votedFor: null,
      votesReceived: [],
      nextIndex: null,
      matchIndex: null,
    };
    const { state: withNode, schedule } = scheduleElectionTimeout(
      { ...state, nodes: { ...state.nodes, [leaderId]: steppedDown } },
      ctx,
      leaderId,
    );
    return {
      state: withNode,
      events: [
        ...baseEvents,
        termChangedEvent({ nodeId: leaderId, term: response.term }),
        nodeRoleChangedEvent({ nodeId: leaderId, role: "follower" }),
      ],
      schedule,
    };
  }

  if (leader.role !== "leader" || response.term !== leader.currentTerm || !leader.nextIndex || !leader.matchIndex) {
    return { state, events: baseEvents }; // stale/irrelevant — stepped down or from an old term
  }

  if (!response.success) {
    // Log-consistency check failed on the follower — back off by one and
    // let the next heartbeat retry with an earlier prevLogIndex.
    const newNextIndex = Math.max(0, leader.nextIndex[response.followerId] - 1);
    const updatedLeader = { ...leader, nextIndex: { ...leader.nextIndex, [response.followerId]: newNextIndex } };
    return { state: { ...state, nodes: { ...state.nodes, [leaderId]: updatedLeader } }, events: baseEvents };
  }

  const updatedLeader = {
    ...leader,
    matchIndex: { ...leader.matchIndex, [response.followerId]: response.matchIndex },
    nextIndex: { ...leader.nextIndex, [response.followerId]: response.matchIndex + 1 },
  };
  const withUpdate: RaftState = { ...state, nodes: { ...state.nodes, [leaderId]: updatedLeader } };
  const { state: finalState, events: commitEvents } = tryAdvanceCommitIndex(withUpdate, leaderId);

  return { state: finalState, events: [...baseEvents, ...commitEvents] };
}

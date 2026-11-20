import { messageDeliveredEvent, messageDroppedEvent } from "../../simulation/events/networkEvents";
import type { ReduceContext, ReduceResult, ScheduleRequest, SimEventDraft } from "../../simulation/engine/types";
import { ELECTION_MODULE_ID } from "./constants";
import { nodeRoleChangedEvent, type ElectionMessageKind } from "./electionEvents";
import { beginElection, broadcast, COORDINATOR_TIMEOUT_TICKS, declareLeader } from "./electionReducer";
import type { ElectionState } from "./electionState";
import type { ElectionTimerPayload } from "./electionTimers";

interface ElectionMessagePayload {
  kind: ElectionMessageKind;
}

/**
 * Handles every timer kind this module schedules:
 *
 * 1. `DELIVER_MESSAGE`: same stale/destination-crashed/partitioned/
 *    random-loss rules the networking module uses — this module reuses the
 *    network transport, not reinvents it. What happens on a successful
 *    delivery depends on the message `kind`:
 *    - `election`: the receiver always replies OK, then reacts by role: a
 *      plain follower joins the election, bubbling up toward whoever
 *      outranks it (see docs/10-election-module-design.md); a candidate
 *      already running its own election does nothing further; a leader
 *      immediately reasserts itself (re-broadcasting COORDINATOR) rather
 *      than letting the asker wait out a timeout to learn it already lost.
 *    - `ok`: only the first OK matters to a waiting candidate; it stops
 *      waiting on ELECTION_TIMEOUT and starts waiting on
 *      COORDINATOR_TIMEOUT instead. A stray/duplicate OK is a no-op.
 *    - `coordinator`: the receiver adopts `follower` (no-op if already
 *      follower, consistent with NODE_ROLE_CHANGED only representing a
 *      real transition).
 * 2. `ELECTION_TIMEOUT`: a candidate that got no OK at all declares itself
 *    leader. Stale (no-op) if the node already got an OK, or resolved
 *    another way.
 * 3. `COORDINATOR_TIMEOUT`: a candidate that got an OK but never heard who
 *    won restarts its own election — the higher node that answered may
 *    since have crashed or been partitioned away.
 */
export function onElectionTimer(
  state: ElectionState,
  payload: unknown,
  ctx: ReduceContext,
): ReduceResult<ElectionState> {
  const timer = payload as ElectionTimerPayload;

  if (timer.type === "ELECTION_TIMEOUT") {
    const node = state.nodes[timer.nodeId];
    if (!node || node.role !== "candidate" || node.awaitingCoordinator) {
      return { state, events: [] }; // stale: already got an OK, or resolved another way
    }
    return declareLeader(state, ctx, timer.nodeId);
  }

  if (timer.type === "COORDINATOR_TIMEOUT") {
    const node = state.nodes[timer.nodeId];
    if (!node || node.role !== "candidate" || !node.awaitingCoordinator) {
      return { state, events: [] }; // stale: already resolved another way
    }
    return beginElection(state, ctx, timer.nodeId, "no-coordinator-timeout");
  }

  const message = state.messages[timer.messageId];
  if (!message || message.status !== "in-flight") {
    return { state, events: [] };
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
      events: [messageDroppedEvent(ELECTION_MODULE_ID, { messageId: timer.messageId, reason })],
    };
  }

  const deliveredState: ElectionState = {
    ...state,
    messages: { ...state.messages, [timer.messageId]: { ...message, status: "delivered" } },
  };
  const events: SimEventDraft[] = [messageDeliveredEvent(ELECTION_MODULE_ID, { messageId: timer.messageId })];
  const kind = (message.payload as ElectionMessagePayload).kind;
  const node = deliveredState.nodes[message.to];

  if (!node) {
    return { state: deliveredState, events };
  }

  if (kind === "coordinator") {
    if (node.role === "follower") {
      return { state: deliveredState, events };
    }
    return {
      state: {
        ...deliveredState,
        nodes: { ...deliveredState.nodes, [node.id]: { ...node, role: "follower", awaitingCoordinator: false } },
      },
      events: [...events, nodeRoleChangedEvent({ nodeId: node.id, role: "follower" })],
    };
  }

  if (kind === "ok") {
    if (node.role !== "candidate" || node.awaitingCoordinator) {
      return { state: deliveredState, events }; // stale or duplicate OK
    }
    return {
      state: {
        ...deliveredState,
        nodes: { ...deliveredState.nodes, [node.id]: { ...node, awaitingCoordinator: true } },
      },
      events,
      schedule: [
        { dueTick: ctx.tick + COORDINATOR_TIMEOUT_TICKS, payload: { type: "COORDINATOR_TIMEOUT", nodeId: node.id } },
      ],
    };
  }

  // kind === "election": always reply OK, then react based on current role.
  const reply = broadcast(deliveredState, ctx, message.to, [message.from], "ok");
  let resultState = reply.state;
  let resultEvents = [...events, ...reply.events];
  let resultSchedule: ScheduleRequest[] = [...reply.schedule];

  if (node.role === "follower") {
    // Not already in an election — join it, bubbling up toward whoever
    // outranks this node.
    const bubbled = beginElection(resultState, ctx, node.id, "bubbled-up");
    resultState = bubbled.state;
    resultEvents = [...resultEvents, ...bubbled.events];
    resultSchedule = [...resultSchedule, ...(bubbled.schedule ?? [])];
  } else if (node.role === "leader") {
    // Already the leader: a plain OK would leave the asker waiting out a
    // full timeout cycle before learning a leader already exists, so
    // reassert leadership immediately instead (see the Milestone 18
    // re-election guided steps, which surfaced this as a real gap).
    const reassert = declareLeader(resultState, ctx, node.id);
    resultState = reassert.state;
    resultEvents = [...resultEvents, ...reassert.events];
    resultSchedule = [...resultSchedule, ...(reassert.schedule ?? [])];
  }

  return { state: resultState, events: resultEvents, schedule: resultSchedule };
}

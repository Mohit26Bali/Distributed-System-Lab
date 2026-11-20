import { messageDeliveredEvent, messageDroppedEvent } from "../../simulation/events/networkEvents";
import type { ReduceContext, ReduceResult, ScheduleRequest, SimEventDraft } from "../../simulation/engine/types";
import { REPLICATION_MODULE_ID } from "./constants";
import {
  readServedEvent,
  writeAcknowledgedEvent,
  writeReplicatedEvent,
  type ReplicationMessageKind,
  type ReplicationMode,
} from "./replicationEvents";
import { sendReplicationMessage } from "./replicationReducer";
import { majorityOf, otherAliveNodeIds, type QuorumReadResponse, type ReplicationState } from "./replicationState";
import type { ReplicationTimerPayload } from "./replicationTimers";

interface ReplicationMessagePayload {
  kind: ReplicationMessageKind;
  key: string;
  value: string;
  mode?: ReplicationMode;
  found?: boolean;
  version?: number;
  requestId?: string;
  servedByNodeId?: string;
}

function pickWinningResponse(responses: readonly QuorumReadResponse[]): QuorumReadResponse {
  let winner = responses[0];
  for (const response of responses.slice(1)) {
    if (response.version > winner.version) winner = response;
  }
  return winner;
}

/**
 * Handles message delivery timers. Fault/staleness rules are identical to
 * every prior module's transport (stale/destination-crashed/partitioned/
 * random-loss, checked in the same order, including the reorder-staleness
 * check every prior module needs — see Milestone 26's Raft bug for why
 * this one specifically must never be skipped).
 *
 * - `replicate` delivered: the follower applies the write to its own store
 *   and emits WRITE_REPLICATED. If the message's embedded mode is `sync`
 *   or `quorum`, it replies with `replicate-ack` (async never does).
 * - `replicate-ack` delivered: for a sync write, the leader removes this
 *   follower from the write's pending-ack list; once empty,
 *   WRITE_ACKNOWLEDGED fires. For a quorum write, the leader instead adds
 *   this follower to the write's ackedBy list; once ackedBy.length + 1
 *   (the leader's own local write) reaches the required majority,
 *   WRITE_ACKNOWLEDGED fires the same way — it just takes fewer acks.
 * - `read-forward` delivered (arrives at the leader): replies with
 *   `read-forward-response` carrying the leader's own current value.
 * - `read-forward-response` delivered (arrives back at the original
 *   requester): emits READ_SERVED — the terminal event for a strong read.
 * A quorum read from the LEADER answers immediately from local state (no
 * messages at all — see replicationReducer.ts's READ case), since the
 * leader's own copy is always at least as current as anything a quorum
 * could produce. A quorum read from a FOLLOWER can't fan out itself (this
 * star topology gives only the leader direct links to everyone), so it
 * asks the leader to coordinate on its behalf instead:
 *
 * - `quorum-coordinate-request` delivered (arrives at the leader): the
 *   requesting follower's own local (value, version) rode along on the
 *   request, so it's counted as one response for free; the leader adds
 *   its own local answer as a second. If that's already a majority,
 *   the leader resolves immediately. Otherwise it fans out
 *   `quorum-read-forward` to every OTHER follower (the requester is
 *   already counted, so it's excluded) and waits for more responses.
 * - `quorum-read-forward` delivered (arrives at a follower being polled):
 *   replies with `quorum-read-response` carrying that follower's own
 *   (possibly stale) value and version.
 * - `quorum-read-response` delivered (arrives back at the leader):
 *   accumulates into that request's response list; once a majority of
 *   the cluster has answered, the highest-version response wins and the
 *   leader relays it back to the original requester via
 *   `quorum-coordinate-response`.
 * - `quorum-coordinate-response` delivered (arrives back at the original
 *   requester): emits READ_SERVED — the terminal event for a quorum read.
 */
export function onReplicationTimer(
  state: ReplicationState,
  payload: unknown,
  ctx: ReduceContext,
): ReduceResult<ReplicationState> {
  const timer = payload as ReplicationTimerPayload;

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
        messages: { ...state.messages, [timer.messageId]: { ...message, status: "dropped" } },
      },
      events: [messageDroppedEvent(REPLICATION_MODULE_ID, { messageId: timer.messageId, reason })],
    };
  }

  const deliveredState: ReplicationState = {
    ...state,
    messages: { ...state.messages, [timer.messageId]: { ...message, status: "delivered" } },
  };
  const events: SimEventDraft[] = [messageDeliveredEvent(REPLICATION_MODULE_ID, { messageId: timer.messageId })];
  const node = deliveredState.nodes[message.to];

  if (!node) {
    return { state: deliveredState, events };
  }

  const { kind, key, value, mode, found, version, requestId, servedByNodeId } =
    message.payload as ReplicationMessagePayload;

  if (kind === "replicate") {
    const withStore: ReplicationState = {
      ...deliveredState,
      nodes: { ...deliveredState.nodes, [node.id]: { ...node, store: { ...node.store, [key]: value } } },
      storeVersions: {
        ...deliveredState.storeVersions,
        [node.id]: { ...deliveredState.storeVersions[node.id], [key]: version ?? 0 },
      },
    };
    const replicatedEvents = [...events, writeReplicatedEvent({ nodeId: node.id, key, value, version: version ?? 0 })];

    if (mode !== "sync" && mode !== "quorum") {
      return { state: withStore, events: replicatedEvents };
    }

    const reply = sendReplicationMessage(withStore, ctx, node.id, message.from, "replicate-ack", key, value);
    return { state: reply.state, events: [...replicatedEvents, ...reply.events], schedule: reply.schedule };
  }

  if (kind === "read-forward") {
    // Arrives at the leader — reply with its own current value for key.
    const leaderValue = node.store[key];
    const leaderFound = leaderValue !== undefined;
    const reply = sendReplicationMessage(
      deliveredState,
      ctx,
      node.id,
      message.from,
      "read-forward-response",
      key,
      leaderFound ? leaderValue : "",
      { found: leaderFound },
    );
    return { state: reply.state, events: [...events, ...reply.events], schedule: reply.schedule };
  }

  if (kind === "read-forward-response") {
    // Arrives back at the node that originally issued the strong read.
    return {
      state: deliveredState,
      events: [
        ...events,
        readServedEvent({
          nodeId: node.id,
          key,
          value: found ? value : undefined,
          found: found ?? false,
          consistency: "strong",
          servedByNodeId: message.from,
        }),
      ],
    };
  }

  if (kind === "quorum-coordinate-request") {
    // Arrives at the leader — the requester's own local answer rode
    // along on this message, so it's response #1 for free.
    const requesterResponse = {
      nodeId: message.from,
      value: found ? value : undefined,
      version: version ?? 0,
      found: found ?? false,
    };
    const leaderValue = node.store[key];
    const leaderFound = leaderValue !== undefined;
    const leaderVersion = deliveredState.storeVersions[node.id]?.[key] ?? 0;
    const leaderResponse = {
      nodeId: node.id,
      value: leaderFound ? leaderValue : undefined,
      version: leaderVersion,
      found: leaderFound,
    };
    const responses = [requesterResponse, leaderResponse];
    const required = majorityOf(Object.keys(deliveredState.nodes).length);

    if (responses.length >= required) {
      const winner = pickWinningResponse(responses);
      const reply = sendReplicationMessage(
        deliveredState,
        ctx,
        node.id,
        message.from,
        "quorum-coordinate-response",
        key,
        winner.found ? winner.value! : "",
        { found: winner.found, version: winner.version, servedByNodeId: winner.nodeId },
      );
      return { state: reply.state, events: [...events, ...reply.events], schedule: reply.schedule };
    }

    // Not enough yet — poll every OTHER alive follower (the requester is
    // already counted, so it's excluded from the fan-out).
    const others = otherAliveNodeIds(deliveredState, node.id).filter((id) => id !== message.from);
    const requestId = `qr-${deliveredState.nextQuorumRequestId}`;
    let nextState: ReplicationState = {
      ...deliveredState,
      nextQuorumRequestId: deliveredState.nextQuorumRequestId + 1,
    };
    let sendEvents: SimEventDraft[] = [];
    let schedule: ScheduleRequest[] = [];
    for (const peerId of others) {
      const sent = sendReplicationMessage(nextState, ctx, node.id, peerId, "quorum-read-forward", key, "", {
        requestId,
      });
      nextState = sent.state;
      sendEvents = [...sendEvents, ...sent.events];
      schedule = [...schedule, ...sent.schedule];
    }

    const finalState: ReplicationState = {
      ...nextState,
      pendingQuorumReads: {
        ...nextState.pendingQuorumReads,
        [requestId]: { key, initiatorNodeId: message.from, responses, required },
      },
    };
    return { state: finalState, events: [...events, ...sendEvents], schedule };
  }

  if (kind === "quorum-read-forward") {
    // Arrives at a follower being polled — reply with its own local
    // (possibly stale) value/version.
    const peerValue = node.store[key];
    const peerFound = peerValue !== undefined;
    const peerVersion = deliveredState.storeVersions[node.id]?.[key] ?? 0;
    const reply = sendReplicationMessage(
      deliveredState,
      ctx,
      node.id,
      message.from,
      "quorum-read-response",
      key,
      peerFound ? peerValue : "",
      { found: peerFound, version: peerVersion, requestId },
    );
    return { state: reply.state, events: [...events, ...reply.events], schedule: reply.schedule };
  }

  if (kind === "quorum-read-response") {
    // Arrives back at the leader, which is coordinating on the original
    // requester's behalf.
    if (!requestId) {
      return { state: deliveredState, events };
    }
    const pending = deliveredState.pendingQuorumReads[requestId];
    if (!pending) {
      return { state: deliveredState, events }; // already resolved, or stale
    }

    const responses = [
      ...pending.responses,
      { nodeId: message.from, value: found ? value : undefined, version: version ?? 0, found: found ?? false },
    ];

    if (responses.length < pending.required) {
      return {
        state: {
          ...deliveredState,
          pendingQuorumReads: { ...deliveredState.pendingQuorumReads, [requestId]: { ...pending, responses } },
        },
        events,
      };
    }

    const winner = pickWinningResponse(responses);
    const remainingPendingReads = Object.fromEntries(
      Object.entries(deliveredState.pendingQuorumReads).filter(([id]) => id !== requestId),
    );
    const reply = sendReplicationMessage(
      { ...deliveredState, pendingQuorumReads: remainingPendingReads },
      ctx,
      node.id,
      pending.initiatorNodeId,
      "quorum-coordinate-response",
      pending.key,
      winner.found ? winner.value! : "",
      { found: winner.found, version: winner.version, servedByNodeId: winner.nodeId },
    );
    return { state: reply.state, events: [...events, ...reply.events], schedule: reply.schedule };
  }

  if (kind === "quorum-coordinate-response") {
    // Arrives back at the follower that originally issued the quorum read.
    return {
      state: deliveredState,
      events: [
        ...events,
        readServedEvent({
          nodeId: node.id,
          key,
          value: found ? value : undefined,
          found: found ?? false,
          consistency: "quorum",
          servedByNodeId: servedByNodeId ?? message.from,
          version: version ?? 0,
        }),
      ],
    };
  }

  // "replicate-ack": a sync write removes this follower from its pending
  // list; once empty, the write is durable. A quorum write instead adds
  // this follower to its ackedBy list; once ackedBy.length + 1 reaches the
  // required majority, the write is durable — same terminal event either
  // way, just a different resolution rule.
  const syncPending = deliveredState.pendingSyncWrites[key];
  if (syncPending && syncPending.value === value) {
    const stillAwaiting = syncPending.awaiting.filter((id) => id !== message.from);
    if (stillAwaiting.length > 0) {
      return {
        state: {
          ...deliveredState,
          pendingSyncWrites: {
            ...deliveredState.pendingSyncWrites,
            [key]: { ...syncPending, awaiting: stillAwaiting },
          },
        },
        events,
      };
    }

    const remainingSyncPending = Object.fromEntries(
      Object.entries(deliveredState.pendingSyncWrites).filter(([pendingKey]) => pendingKey !== key),
    );
    return {
      state: { ...deliveredState, pendingSyncWrites: remainingSyncPending },
      events: [...events, writeAcknowledgedEvent({ key, value })],
    };
  }

  const quorumPending = deliveredState.pendingQuorumWrites[key];
  if (quorumPending && quorumPending.value === value) {
    if (quorumPending.ackedBy.includes(message.from)) {
      return { state: deliveredState, events }; // duplicate ack — already counted
    }

    const ackedBy = [...quorumPending.ackedBy, message.from];
    if (ackedBy.length + 1 < quorumPending.required) {
      return {
        state: {
          ...deliveredState,
          pendingQuorumWrites: { ...deliveredState.pendingQuorumWrites, [key]: { ...quorumPending, ackedBy } },
        },
        events,
      };
    }

    const remainingQuorumPending = Object.fromEntries(
      Object.entries(deliveredState.pendingQuorumWrites).filter(([pendingKey]) => pendingKey !== key),
    );
    return {
      state: { ...deliveredState, pendingQuorumWrites: remainingQuorumPending },
      events: [...events, writeAcknowledgedEvent({ key, value })],
    };
  }

  return { state: deliveredState, events }; // stale or already-resolved ack
}

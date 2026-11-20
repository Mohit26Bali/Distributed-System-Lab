import type { SimEventDraft, Tick } from "../../simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "../../simulation/events/networkEvents";
import { REPLICATION_MODULE_ID } from "./constants";

export const REPLICATION_EVENT_TYPES = {
  WRITE_ACCEPTED: "WRITE_ACCEPTED",
  WRITE_REPLICATED: "WRITE_REPLICATED",
  WRITE_ACKNOWLEDGED: "WRITE_ACKNOWLEDGED",
  READ_REQUESTED: "READ_REQUESTED",
  READ_SERVED: "READ_SERVED",
} as const;

export type ReplicationMode = "sync" | "async" | "quorum";
export type ConsistencyLevel = "eventual" | "strong" | "quorum";
export type ReplicationMessageKind =
  | "replicate"
  | "replicate-ack"
  | "read-forward"
  | "read-forward-response"
  | "quorum-read-forward"
  | "quorum-read-response"
  | "quorum-coordinate-request"
  | "quorum-coordinate-response";

export interface WriteAcceptedPayload {
  nodeId: string;
  key: string;
  value: string;
  mode: ReplicationMode;
  version: number;
}

export interface WriteReplicatedPayload {
  nodeId: string;
  key: string;
  value: string;
  version: number;
}

export interface WriteAcknowledgedPayload {
  key: string;
  value: string;
}

export interface ReadRequestedPayload {
  nodeId: string;
  key: string;
  consistency: ConsistencyLevel;
}

export interface ReadServedPayload {
  nodeId: string;
  key: string;
  value?: string;
  found: boolean;
  consistency: ConsistencyLevel;
  /** The node whose store actually answered — the leader for a strong
   * read forwarded from a follower, or the winning replica for a quorum
   * read, otherwise the same as `nodeId`. */
  servedByNodeId: string;
  /** Only meaningful for quorum reads — the version of the winning
   * response among however many replicas answered. */
  version?: number;
}

/**
 * Same MESSAGE_SENT event type every prior module's transport uses —
 * replication's two message kinds ride it unmodified. See
 * docs/16-replication-module-design.md.
 */
export interface ReplicationMessageSentPayload {
  messageId: string;
  from: string;
  to: string;
  sentTick: Tick;
  deliveredTick: Tick;
  kind: ReplicationMessageKind;
  key: string;
  value: string;
  /**
   * Only set on `replicate` messages — the mode active when the leader
   * SENT this write, embedded so the receiving follower's decision to
   * reply with `replicate-ack` never depends on its own possibly-stale
   * view of the mode toggle (which could change before delivery).
   */
  mode?: ReplicationMode;
  /**
   * Only set on `read-forward-response`/`quorum-read-response` messages —
   * whether the responder actually had a value for the requested key,
   * since `value` alone can't distinguish "not found" from a legitimately
   * empty string.
   */
  found?: boolean;
  /** Only set on `replicate` and `quorum-read-response` messages — the
   * version the sender associates with this key. */
  version?: number;
  /** Only set on `quorum-read-forward`/`quorum-read-response` messages —
   * correlates a fan-out request with each of its scattered responses. */
  requestId?: string;
  /** Only set on `quorum-coordinate-response` messages — which node's
   * data actually won the quorum the leader coordinated on the
   * requester's behalf. */
  servedByNodeId?: string;
}

export function writeAcceptedEvent(payload: WriteAcceptedPayload): SimEventDraft {
  return { type: REPLICATION_EVENT_TYPES.WRITE_ACCEPTED, moduleId: REPLICATION_MODULE_ID, payload };
}

export function writeReplicatedEvent(payload: WriteReplicatedPayload): SimEventDraft {
  return { type: REPLICATION_EVENT_TYPES.WRITE_REPLICATED, moduleId: REPLICATION_MODULE_ID, payload };
}

export function writeAcknowledgedEvent(payload: WriteAcknowledgedPayload): SimEventDraft {
  return { type: REPLICATION_EVENT_TYPES.WRITE_ACKNOWLEDGED, moduleId: REPLICATION_MODULE_ID, payload };
}

export function readRequestedEvent(payload: ReadRequestedPayload): SimEventDraft {
  return { type: REPLICATION_EVENT_TYPES.READ_REQUESTED, moduleId: REPLICATION_MODULE_ID, payload };
}

export function readServedEvent(payload: ReadServedPayload): SimEventDraft {
  return { type: REPLICATION_EVENT_TYPES.READ_SERVED, moduleId: REPLICATION_MODULE_ID, payload };
}

export function replicationMessageSentEvent(payload: ReplicationMessageSentPayload): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.MESSAGE_SENT, moduleId: REPLICATION_MODULE_ID, payload };
}

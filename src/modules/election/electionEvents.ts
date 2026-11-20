import type { SimEventDraft, Tick } from "../../simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "../../simulation/events/networkEvents";
import { ELECTION_MODULE_ID } from "./constants";

export const ELECTION_EVENT_TYPES = {
  ELECTION_STARTED: "ELECTION_STARTED",
  NODE_ROLE_CHANGED: "NODE_ROLE_CHANGED",
  LEADER_ELECTED: "LEADER_ELECTED",
} as const;

export type ElectionRole = "follower" | "candidate" | "leader";
export type ElectionMessageKind = "election" | "ok" | "coordinator";

export interface ElectionStartedPayload {
  nodeId: string;
  reason: "manual" | "bubbled-up" | "no-coordinator-timeout";
}

export interface NodeRoleChangedPayload {
  nodeId: string;
  role: ElectionRole;
}

export interface LeaderElectedPayload {
  nodeId: string;
}

/**
 * Same MESSAGE_SENT event type Module 1 (networking) already uses — this
 * module's control traffic rides the existing transport unmodified, only
 * adding a `kind` field to the payload to distinguish ELECTION/OK/
 * COORDINATOR. See docs/10-election-module-design.md.
 */
export interface ElectionMessageSentPayload {
  messageId: string;
  from: string;
  to: string;
  sentTick: Tick;
  deliveredTick: Tick;
  kind: ElectionMessageKind;
}

export function electionStartedEvent(payload: ElectionStartedPayload): SimEventDraft {
  return { type: ELECTION_EVENT_TYPES.ELECTION_STARTED, moduleId: ELECTION_MODULE_ID, payload };
}

export function nodeRoleChangedEvent(payload: NodeRoleChangedPayload): SimEventDraft {
  return { type: ELECTION_EVENT_TYPES.NODE_ROLE_CHANGED, moduleId: ELECTION_MODULE_ID, payload };
}

export function leaderElectedEvent(payload: LeaderElectedPayload): SimEventDraft {
  return { type: ELECTION_EVENT_TYPES.LEADER_ELECTED, moduleId: ELECTION_MODULE_ID, payload };
}

export function electionMessageSentEvent(payload: ElectionMessageSentPayload): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.MESSAGE_SENT, moduleId: ELECTION_MODULE_ID, payload };
}

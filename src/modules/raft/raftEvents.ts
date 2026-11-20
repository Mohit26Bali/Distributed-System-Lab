import type { SimEventDraft, Tick } from "../../simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "../../simulation/events/networkEvents";
import { RAFT_MODULE_ID } from "./constants";

export const RAFT_EVENT_TYPES = {
  ELECTION_STARTED: "ELECTION_STARTED",
  NODE_ROLE_CHANGED: "NODE_ROLE_CHANGED",
  TERM_CHANGED: "TERM_CHANGED",
  VOTE_GRANTED: "VOTE_GRANTED",
  LEADER_ELECTED: "LEADER_ELECTED",
  LOG_ENTRY_APPENDED: "LOG_ENTRY_APPENDED",
  LOG_ENTRY_COMMITTED: "LOG_ENTRY_COMMITTED",
} as const;

export type RaftRole = "follower" | "candidate" | "leader";
export type RaftMessageKind = "request-vote" | "vote-response" | "append-entries" | "append-response";

export interface ElectionStartedPayload {
  nodeId: string;
  term: number;
  reason: "manual" | "election-timeout";
}

export interface NodeRoleChangedPayload {
  nodeId: string;
  role: RaftRole;
}

export interface TermChangedPayload {
  nodeId: string;
  term: number;
}

export interface VoteGrantedPayload {
  candidateId: string;
  voterId: string;
  term: number;
}

export interface LeaderElectedPayload {
  nodeId: string;
  term: number;
}

export interface LogEntryAppendedPayload {
  nodeId: string;
  index: number;
  term: number;
  /** The entry's actual content — without this, a state machine built on
   * top of the log (e.g. the Distributed Database capstone) has nothing
   * to derive from; see docs/24-distributed-database-module-design.md. */
  value: string;
}

export interface LogEntryCommittedPayload {
  /** Which node's own commit progress this is — a leader's commit and a
   * given follower's own (possibly lagging) commit are reported
   * separately, both through this same event type. */
  nodeId: string;
  index: number;
  term: number;
}

/**
 * Same MESSAGE_SENT event type Modules 1 and 6 already use — Raft's four
 * message kinds ride the existing transport unmodified, same as election's
 * ELECTION/OK/COORDINATOR did. See docs/12-raft-module-design.md.
 */
export interface RaftMessageSentPayload {
  messageId: string;
  from: string;
  to: string;
  sentTick: Tick;
  deliveredTick: Tick;
  kind: RaftMessageKind;
  [key: string]: unknown;
}

export function electionStartedEvent(payload: ElectionStartedPayload): SimEventDraft {
  return { type: RAFT_EVENT_TYPES.ELECTION_STARTED, moduleId: RAFT_MODULE_ID, payload };
}

export function nodeRoleChangedEvent(payload: NodeRoleChangedPayload): SimEventDraft {
  return { type: RAFT_EVENT_TYPES.NODE_ROLE_CHANGED, moduleId: RAFT_MODULE_ID, payload };
}

export function termChangedEvent(payload: TermChangedPayload): SimEventDraft {
  return { type: RAFT_EVENT_TYPES.TERM_CHANGED, moduleId: RAFT_MODULE_ID, payload };
}

export function voteGrantedEvent(payload: VoteGrantedPayload): SimEventDraft {
  return { type: RAFT_EVENT_TYPES.VOTE_GRANTED, moduleId: RAFT_MODULE_ID, payload };
}

export function leaderElectedEvent(payload: LeaderElectedPayload): SimEventDraft {
  return { type: RAFT_EVENT_TYPES.LEADER_ELECTED, moduleId: RAFT_MODULE_ID, payload };
}

export function logEntryAppendedEvent(payload: LogEntryAppendedPayload): SimEventDraft {
  return { type: RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED, moduleId: RAFT_MODULE_ID, payload };
}

export function logEntryCommittedEvent(payload: LogEntryCommittedPayload): SimEventDraft {
  return { type: RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED, moduleId: RAFT_MODULE_ID, payload };
}

export function raftMessageSentEvent(payload: RaftMessageSentPayload): SimEventDraft {
  return { type: NETWORK_EVENT_TYPES.MESSAGE_SENT, moduleId: RAFT_MODULE_ID, payload };
}

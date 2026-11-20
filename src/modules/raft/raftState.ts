import type { Message } from "../../simulation/models/Message";
import type { NodeStatus } from "../../simulation/models/Node";
import type { RaftRole } from "./raftEvents";

export interface LogEntry {
  term: number;
  index: number; // position in the log, 0-based
  value: string; // opaque label — no real state machine needed to teach commit safety
}

export interface RaftNodeState {
  id: string;
  status: NodeStatus;
  role: RaftRole;
  currentTerm: number;
  votedFor: string | null; // only meaningful for the current term
  log: LogEntry[];
  commitIndex: number;
  // Leader-only volatile state — present (non-null) only while this node is
  // leader; unused but harmless otherwise, per docs/04-simulation-engine.md's
  // "module-specific state is opaque to the engine."
  nextIndex: Record<string, number> | null;
  matchIndex: Record<string, number> | null;
  // Candidate-only bookkeeping: which node ids have granted this node's
  // current candidacy a vote. Reset to [] whenever role leaves "candidate".
  votesReceived: string[];
  /**
   * Bumped every time a new ELECTION_TIMEOUT is scheduled (or invalidated
   * on becoming leader). The engine has no way to cancel an
   * already-scheduled timer, so a fired ELECTION_TIMEOUT whose token
   * doesn't match this node's current value is stale — a newer one has
   * since superseded it (a heartbeat arrived, a vote was granted, etc.).
   */
  electionTimeoutToken: number;
}

export interface RaftState {
  nodes: Record<string, RaftNodeState>;
  messages: Record<string, Message>;
  nextMessageId: number;
}

export function createInitialRaftState(nodeIds: string[]): RaftState {
  const nodes: Record<string, RaftNodeState> = {};
  for (const id of nodeIds) {
    nodes[id] = {
      id,
      status: "alive",
      role: "follower",
      currentTerm: 0,
      votedFor: null,
      log: [],
      // -1, not 0: log indices are 0-based here, so 0 is a real entry —
      // -1 is the "nothing committed yet" sentinel, matching
      // lastLogTermAndIndex's convention for an empty log.
      commitIndex: -1,
      nextIndex: null,
      matchIndex: null,
      votesReceived: [],
      electionTimeoutToken: 0,
    };
  }
  return { nodes, messages: {}, nextMessageId: 0 };
}

/** The last log entry's (term, index), or the Raft-conventional (0, -1) for an empty log. */
export function lastLogTermAndIndex(log: readonly LogEntry[]): { term: number; index: number } {
  const last = log[log.length - 1];
  return last ? { term: last.term, index: last.index } : { term: 0, index: -1 };
}

/**
 * Raft's election-safety restriction: a candidate's log must be at least as
 * up to date as the voter's own — higher last-entry term wins outright; on
 * a tie, the longer (or equal) log wins. This is what guarantees a newly
 * elected leader already holds every previously committed entry.
 */
export function isLogAtLeastAsUpToDate(
  candidateLastLogTerm: number,
  candidateLastLogIndex: number,
  voterLog: readonly LogEntry[],
): boolean {
  const voter = lastLogTermAndIndex(voterLog);
  if (candidateLastLogTerm !== voter.term) {
    return candidateLastLogTerm > voter.term;
  }
  return candidateLastLogIndex >= voter.index;
}

export function majorityOf(clusterSize: number): number {
  return Math.floor(clusterSize / 2) + 1;
}

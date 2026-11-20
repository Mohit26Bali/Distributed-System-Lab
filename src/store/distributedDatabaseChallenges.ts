import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { NODE_EVENT_TYPES } from "@/simulation/events/nodeEvents";
import {
  RAFT_EVENT_TYPES,
  type LeaderElectedPayload,
  type LogEntryCommittedPayload,
} from "@/modules/raft/raftEvents";
import type { ChallengeDefinition } from "./challenges";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function countEventType(events: readonly SimEvent[], type: string): number {
  return events.filter((event) => event.type === type).length;
}

export const DISTRIBUTED_DATABASE_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "stale-follower-view",
    title: "Challenge: Catch It Stale",
    prompt:
      "Partition a follower away, then PUT a key — that follower's own KV view (check via GET) should now disagree with the leader's.",
    isComplete: (events) =>
      hasEventType(events, NETWORK_EVENT_TYPES.PARTITION_STARTED) &&
      hasEventType(events, RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED),
  },
  {
    id: "survive-a-leader-failure-no-data-lost",
    title: "Challenge: No Data Lost",
    prompt: "Commit a PUT, kill the leader, elect a new one, and confirm (via GET) the value survived.",
    isComplete: (events) =>
      countEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED) >= 2 &&
      hasEventType(events, RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED) &&
      hasEventType(events, NODE_EVENT_TYPES.NODE_CRASHED),
  },
  {
    id: "leader-commits-before-followers",
    title: "Challenge: Leader Commits First",
    prompt:
      "PUT a key, then confirm in the event log that the leader's own commit for that entry always fires at an earlier tick than any follower's commit of the same entry — the leader decides first, followers only ever catch up.",
    isComplete: (events) => {
      const lastLeaderElected = [...events].reverse().find((event) => event.type === RAFT_EVENT_TYPES.LEADER_ELECTED);
      if (!lastLeaderElected) return false;
      const leaderId = (lastLeaderElected.payload as LeaderElectedPayload).nodeId;

      const commits = events.filter((event) => event.type === RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED);
      const leaderCommits = commits.filter((event) => (event.payload as LogEntryCommittedPayload).nodeId === leaderId);
      const followerCommits = commits.filter(
        (event) => (event.payload as LogEntryCommittedPayload).nodeId !== leaderId,
      );

      return leaderCommits.some((leaderCommit) =>
        followerCommits.some(
          (followerCommit) =>
            (followerCommit.payload as LogEntryCommittedPayload).index ===
              (leaderCommit.payload as LogEntryCommittedPayload).index && followerCommit.tick > leaderCommit.tick,
        ),
      );
    },
  },
];

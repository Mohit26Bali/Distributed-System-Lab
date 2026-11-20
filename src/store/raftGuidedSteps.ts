import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { RAFT_EVENT_TYPES, type ElectionStartedPayload } from "@/modules/raft/raftEvents";
import type { GuidedStepDefinition } from "./guidedSteps";

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function hasElectionStartedReason(events: readonly SimEvent[], reason: ElectionStartedPayload["reason"]): boolean {
  return events.some(
    (event) =>
      event.type === RAFT_EVENT_TYPES.ELECTION_STARTED &&
      (event.payload as ElectionStartedPayload).reason === reason,
  );
}

// Unlike Bully, kills/partitions here don't force a specific ordering —
// "the leader" is whichever node the learner elected, not a fixed id, so
// these steps can follow the design doc's original order unchanged.
export const RAFT_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "bootstrap-election",
    instruction: 'Select any node and click "Start Election."',
    observation:
      "It requested votes from everyone else and became leader once it held a majority — heartbeats are now running automatically, with no further clicks needed to keep the cluster alive.",
    isSatisfied: (events) => hasEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED),
  },
  {
    id: "submit-and-commit",
    instruction: 'Select the leader (check the crown or the inspector), then click "Submit Entry."',
    observation:
      "LOG_ENTRY_APPENDED committed to the leader's own log immediately — but LOG_ENTRY_COMMITTED only followed once a majority of followers had replicated it too. Check the inspector's commit index on a couple of nodes.",
    isSatisfied: (events) => hasEventType(events, RAFT_EVENT_TYPES.LOG_ENTRY_COMMITTED),
  },
  {
    id: "kill-leader-auto-recover",
    instruction:
      'Select the current leader, click "Kill Node" — then just wait. Don\'t start a new election yourself.',
    observation:
      "A follower's own election timeout fired on its own and a new leader emerged automatically — this is the one place in the whole platform where a role change happens without a learner click behind it.",
    isSatisfied: (events) =>
      hasElectionStartedReason(events, "election-timeout") && hasEventType(events, RAFT_EVENT_TYPES.LEADER_ELECTED),
  },
  {
    id: "partition-minority-cant-commit",
    instruction: 'Click "Partition" to isolate the current leader alone, then select it and click "Submit Entry."',
    observation:
      "The entry was accepted into the leader's own log (LOG_ENTRY_APPENDED) — but check the inspector: its commit index never advances. A 1-node minority can never reach a majority, no matter how long you wait.",
    isSatisfied: (events) => hasEventType(events, RAFT_EVENT_TYPES.LOG_ENTRY_APPENDED),
  },
  {
    id: "heal-reconciles-stale-log",
    instruction: 'Click "Heal" in the fault menu.',
    observation:
      "Once the isolated node hears from the real leader the majority elected without it, its own uncommitted entry gets overwritten — proof Raft replaces a stale log rather than merging it.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.PARTITION_HEALED),
  },
];

import type { SimEvent } from "@/simulation/engine/types";
import { ELECTION_EVENT_TYPES, type ElectionStartedPayload, type LeaderElectedPayload } from "@/modules/election/electionEvents";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import type { GuidedStepDefinition } from "./guidedSteps";

function leaderElectedFor(events: readonly SimEvent[], nodeId: string): boolean {
  return events.some(
    (event) =>
      event.type === ELECTION_EVENT_TYPES.LEADER_ELECTED &&
      (event.payload as LeaderElectedPayload).nodeId === nodeId,
  );
}

function electionStartedWithReason(events: readonly SimEvent[], reason: ElectionStartedPayload["reason"]): boolean {
  return events.some(
    (event) =>
      event.type === ELECTION_EVENT_TYPES.ELECTION_STARTED &&
      (event.payload as ElectionStartedPayload).reason === reason,
  );
}

// Order matters, same as networking's guided steps: kills are permanent
// (no recovery mechanic), so the split-brain lesson (which needs nodes 4
// and 5 both still alive) must come BEFORE either kill step, not after —
// see docs/10-election-module-design.md's "Guided lessons" list, reordered
// here to fit one continuous, irreversible session.
export const ELECTION_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "bubble-up",
    instruction: 'Select node 1, then click "Start Election."',
    observation:
      "Node 5 won, even though node 1 started it — watch the ELECTION messages bubble up through the timeline: each node that heard about the election answered OK and started its own, until node 5 ran out of anyone higher to ask.",
    isSatisfied: (events) => leaderElectedFor(events, "5"),
  },
  {
    id: "split-brain",
    instruction:
      'Click "Partition" in the fault menu to isolate node 5, then select node 1 again and click "Start Election."',
    observation:
      "Node 4 just became leader too — within the reachable group, it's the highest alive node. Node 5 (still alive, just unreachable) never heard any of this, so it still believes it's the leader. Check the inspector on each: two leaders exist at once.",
    isSatisfied: (events) => leaderElectedFor(events, "4"),
  },
  {
    id: "heal-does-not-fix",
    instruction: 'Click "Heal" in the fault menu.',
    observation:
      'Nothing about the two leaders changed automatically — Bully has no way to notice a healed partition on its own. Node 4 and node 5 both still believe they\'re in charge until a new election forces the question again.',
    isSatisfied: (events) =>
      events.some((event) => event.type === NETWORK_EVENT_TYPES.PARTITION_HEALED),
  },
  {
    id: "kill-leader-reelect",
    instruction: 'Select node 5, click "Kill Node," then select node 1 and click "Start Election" again.',
    observation:
      "Node 4 is confirmed leader now that node 5 is genuinely gone, not just unreachable — the next-highest alive node won, exactly as Bully promises.",
    isSatisfied: (events) => leaderElectedFor(events, "4"),
  },
  {
    id: "kill-two-highest-reelect",
    instruction: 'Select node 4, click "Kill Node," then select node 1 and click "Start Election" one more time.',
    observation:
      "With both node 5 and node 4 dead, node 3 — the third-highest — won. Bully always finds the highest node that's actually still alive, however far down the list that turns out to be.",
    isSatisfied: (events) => leaderElectedFor(events, "3"),
  },
];

// Re-exported for the challenge/quiz checkers below, which need the same
// "did a bubbled-up election or a timeout-driven restart ever happen"
// vocabulary without duplicating the event-payload casts.
export { leaderElectedFor, electionStartedWithReason };

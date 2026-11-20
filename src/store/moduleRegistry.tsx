import type { ReactNode } from "react";

import { deriveKvStoreForNode } from "@/hooks/useKvStore";
import { deriveLastReadServed } from "@/hooks/useLastReadServed";
import { deriveNodeRole } from "@/hooks/useNodeRole";
import { deriveNodeTerm } from "@/hooks/useNodeTerm";
import { deriveCommittedThroughIndex, deriveLogLength, deriveNodeCommitIndex } from "@/hooks/useRaftLogSummary";
import {
  deriveNodeStore,
  deriveNodeStoreVersions,
  derivePendingQuorumKeys,
  derivePendingSyncKeys,
} from "@/hooks/useReplicationStoreSummary";
import { createElectionModule } from "@/modules/election/electionModule";
import { priorityOf } from "@/modules/election/electionState";
import { createNetworkingModule } from "@/modules/networking/networkingModule";
import { createRaftModule } from "@/modules/raft/raftModule";
import { createReplicationModule } from "@/modules/replication/replicationModule";
import type { SimEvent, SimulationModule, Tick } from "@/simulation/engine/types";
import type { LinkConfig } from "@/simulation/network/types";
import { NETWORKING_CHALLENGES, type ChallengeDefinition } from "./challenges";
import { CAP_CHALLENGES } from "./capChallenges";
import { CAP_GUIDED_STEPS } from "./capGuidedSteps";
import { CAP_QUIZZES } from "./capQuiz";
import { CONSISTENCY_CHALLENGES } from "./consistencyChallenges";
import { CONSISTENCY_GUIDED_STEPS } from "./consistencyGuidedSteps";
import { CONSISTENCY_QUIZZES } from "./consistencyQuiz";
import { DISTRIBUTED_DATABASE_CHALLENGES } from "./distributedDatabaseChallenges";
import { DISTRIBUTED_DATABASE_GUIDED_STEPS } from "./distributedDatabaseGuidedSteps";
import { DISTRIBUTED_DATABASE_QUIZZES } from "./distributedDatabaseQuiz";
import { ELECTION_CHALLENGES } from "./electionChallenges";
import { ELECTION_GUIDED_STEPS } from "./electionGuidedSteps";
import { ELECTION_QUIZZES } from "./electionQuiz";
import { FAULT_INJECTION_CHALLENGES } from "./faultInjectionChallenges";
import { FAULT_INJECTION_GUIDED_STEPS } from "./faultInjectionGuidedSteps";
import { FAULT_INJECTION_QUIZZES } from "./faultInjectionQuiz";
import { NETWORKING_GUIDED_STEPS, type GuidedStepDefinition } from "./guidedSteps";
import { NETWORKING_QUIZ, type PredictiveQuizDefinition } from "./quiz";
import { QUORUM_CHALLENGES } from "./quorumChallenges";
import { QUORUM_GUIDED_STEPS } from "./quorumGuidedSteps";
import { QUORUM_QUIZZES } from "./quorumQuiz";
import { RAFT_CHALLENGES } from "./raftChallenges";
import { RAFT_GUIDED_STEPS } from "./raftGuidedSteps";
import { RAFT_QUIZZES } from "./raftQuiz";
import { REPLICATION_CHALLENGES } from "./replicationChallenges";
import { REPLICATION_GUIDED_STEPS } from "./replicationGuidedSteps";
import { REPLICATION_QUIZZES } from "./replicationQuiz";

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Generic over each module's own State/Action shape (e.g. NetworkingState
 * vs. ElectionState), per docs/10-election-module-design.md's "Required
 * framework generalization" — the registry, page, and generic components
 * never need to know the concrete shape, only `SimulationModule<State,
 * Action>`'s already-generic interface.
 */
export interface ModuleDefinition<State = unknown, Action = unknown> {
  id: string;
  title: string;
  summary: string;
  /** A few short paragraphs — plain strings, not MDX; see docs/09-implementation-roadmap.md. */
  description: string[];
  nodeIds: string[];
  links: LinkConfig[];
  nodePositions: Record<string, NodePosition>;
  createModule: () => SimulationModule<State, Action>;
  /** Absent (not empty array) means this module has no guided content yet. */
  guidedSteps?: GuidedStepDefinition[];
  quizzes?: PredictiveQuizDefinition[];
  challenges?: ChallengeDefinition[];
  /**
   * Module-specific detail shown below the generic id/status fields in the
   * inspector. One optional hook, sized to this module's actual need —
   * see docs/10-election-module-design.md's "Inspector" section for why
   * this isn't a general renderer/plugin system.
   */
  renderNodeDetail?: (nodeId: string, events: readonly SimEvent[], tick: Tick) => ReactNode;
}

// Shared by both the `raft` and `fault-injection` entries — same engine,
// same topology, only the content differs. Complete graph: votes and
// heartbeats need every node reachable from every other. Lettered ids
// (not numbered, unlike election) since there's no priority ordering here
// — any node can win, depending on timing and term.
const RAFT_NODE_IDS = ["A", "B", "C", "D", "E"];
const RAFT_LINKS: LinkConfig[] = [
  { id: "A-B", from: "A", to: "B", latencyTicks: 3 },
  { id: "A-C", from: "A", to: "C", latencyTicks: 3 },
  { id: "A-D", from: "A", to: "D", latencyTicks: 3 },
  { id: "A-E", from: "A", to: "E", latencyTicks: 3 },
  { id: "B-C", from: "B", to: "C", latencyTicks: 3 },
  { id: "B-D", from: "B", to: "D", latencyTicks: 3 },
  { id: "B-E", from: "B", to: "E", latencyTicks: 3 },
  { id: "C-D", from: "C", to: "D", latencyTicks: 3 },
  { id: "C-E", from: "C", to: "E", latencyTicks: 3 },
  { id: "D-E", from: "D", to: "E", latencyTicks: 3 },
];
const RAFT_NODE_POSITIONS: Record<string, NodePosition> = {
  A: { x: 300, y: 40 },
  B: { x: 433, y: 137 },
  C: { x: 382, y: 293 },
  D: { x: 218, y: 293 },
  E: { x: 167, y: 137 },
};

// Shared by `replication`, `consistency`, and `cap` for the store-contents
// portion only — `replication` has its own pending-sync-writes row that
// the other two don't need, so it isn't fully factored out here.
function renderConsistencyNodeDetail(nodeId: string, events: readonly SimEvent[], tick: Tick): ReactNode {
  const role = nodeId === "leader" ? "leader" : "follower";
  const store = deriveNodeStore(events, nodeId, tick);
  const storeEntries = Object.entries(store);
  const lastRead = deriveLastReadServed(events, nodeId, tick);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      <dt className="text-text-muted">Role</dt>
      <dd className="font-mono text-text-primary">{role}</dd>
      <dt className="text-text-muted">Store</dt>
      <dd className="font-mono text-text-primary">
        {storeEntries.length === 0 ? "empty" : storeEntries.map(([k, v]) => `${k}=${v}`).join(", ")}
      </dd>
      <dt className="text-text-muted">Last read served</dt>
      <dd className="font-mono text-text-primary">
        {!lastRead
          ? "none yet"
          : `${lastRead.key}=${lastRead.found ? lastRead.value : "(not found)"} (${lastRead.consistency}, by ${
              lastRead.servedByNodeId
            }, ${lastRead.roundTripTicks} ticks)`}
      </dd>
    </dl>
  );
}

function renderRaftNodeDetail(nodeId: string, events: readonly SimEvent[], tick: Tick): ReactNode {
  const role = deriveNodeRole(events, nodeId, tick);
  const term = deriveNodeTerm(events, nodeId, tick);
  const logLength = deriveLogLength(events, nodeId, tick);
  const committedThrough = deriveCommittedThroughIndex(events, tick);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      <dt className="text-text-muted">Role</dt>
      <dd className="font-mono text-text-primary">{role}</dd>
      <dt className="text-text-muted">Term</dt>
      <dd className="font-mono text-text-primary">{term}</dd>
      <dt className="text-text-muted">Log entries</dt>
      <dd className="font-mono text-text-primary">{logLength}</dd>
      <dt className="text-text-muted">Committed through (cluster)</dt>
      <dd className="font-mono text-text-primary">{committedThrough === -1 ? "none yet" : committedThrough}</dd>
    </dl>
  );
}

export const MODULE_REGISTRY: Record<string, ModuleDefinition<unknown, unknown>> = {
  introduction: {
    id: "introduction",
    title: "Introduction",
    summary: "Get oriented with the controls on a minimal two-node network.",
    description: [
      "This is the simplest possible simulation: two nodes, one link. Use it to get comfortable with the controls before moving on to a real module.",
      "Send a message, then use the timeline to scrub backward and forward through what happened. Try killing a node or dropping a message to see how faults are recorded as real events, not just visual effects.",
    ],
    nodeIds: ["a", "b"],
    links: [{ id: "a-b", from: "a", to: "b", latencyTicks: 4 }],
    nodePositions: {
      a: { x: 120, y: 160 },
      b: { x: 420, y: 160 },
    },
    createModule: () => createNetworkingModule(["a", "b"]),
  },

  networking: {
    id: "networking",
    title: "Networking",
    summary: "Messages travel over links with real latency — nothing is instantaneous.",
    description: [
      "A network is not a reliable, instant pipe. Every link here has a configured latency: a sent message doesn't arrive until a specific number of ticks later, and you can watch it travel.",
      "Kill a node mid-flight and see the asymmetry: a message already sent by a node that then crashes still arrives, but a message arriving at an already-crashed node is dropped instead.",
      "A message can fail to arrive for more than one reason: a partition can silently cut off a whole group of nodes, a configured drop rate can lose messages purely by chance, and either one is inspectable as an explicit reason once dropped. You can also reorder a message's arrival relative to others, or duplicate one so it arrives twice.",
    ],
    nodeIds: ["a", "b", "c"],
    links: [
      { id: "a-b", from: "a", to: "b", latencyTicks: 3 },
      { id: "a-c", from: "a", to: "c", latencyTicks: 3 },
      { id: "b-c", from: "b", to: "c", latencyTicks: 3 },
    ],
    nodePositions: {
      a: { x: 80, y: 160 },
      b: { x: 320, y: 40 },
      c: { x: 320, y: 280 },
    },
    createModule: () => createNetworkingModule(["a", "b", "c"]),
    guidedSteps: NETWORKING_GUIDED_STEPS,
    quizzes: [NETWORKING_QUIZ],
    challenges: NETWORKING_CHALLENGES,
  },

  election: {
    id: "election",
    title: "Leader Election (Bully)",
    summary: "The highest-numbered alive node always wins — but only once everyone agrees.",
    description: [
      "Five numbered nodes need to agree on a single coordinator. The Bully algorithm's rule is simple: the highest-numbered node that's still alive wins, but every node has to find that out through messages, not by magic.",
      "Start an election on any node. Watch it bubble up: every node that hears about the election answers OK and starts its own election against nodes higher than itself, until the true highest-priority alive node runs out of anyone to ask and declares itself leader.",
      "Kill the leader and start a new election — the next-highest alive node wins. Partition the highest node away first, and the remaining group can elect a leader that wouldn't have won had everyone been reachable — healing the partition afterward doesn't fix this by itself.",
    ],
    // Complete graph: Bully requires every node to reach every other node
    // directly, unlike Module 1's arbitrary topology.
    nodeIds: ["1", "2", "3", "4", "5"],
    links: [
      { id: "1-2", from: "1", to: "2", latencyTicks: 3 },
      { id: "1-3", from: "1", to: "3", latencyTicks: 3 },
      { id: "1-4", from: "1", to: "4", latencyTicks: 3 },
      { id: "1-5", from: "1", to: "5", latencyTicks: 3 },
      { id: "2-3", from: "2", to: "3", latencyTicks: 3 },
      { id: "2-4", from: "2", to: "4", latencyTicks: 3 },
      { id: "2-5", from: "2", to: "5", latencyTicks: 3 },
      { id: "3-4", from: "3", to: "4", latencyTicks: 3 },
      { id: "3-5", from: "3", to: "5", latencyTicks: 3 },
      { id: "4-5", from: "4", to: "5", latencyTicks: 3 },
    ],
    nodePositions: {
      "1": { x: 300, y: 40 },
      "2": { x: 433, y: 137 },
      "3": { x: 382, y: 293 },
      "4": { x: 218, y: 293 },
      "5": { x: 167, y: 137 },
    },
    createModule: () => createElectionModule(["1", "2", "3", "4", "5"]),
    guidedSteps: ELECTION_GUIDED_STEPS,
    quizzes: ELECTION_QUIZZES,
    challenges: ELECTION_CHALLENGES,
    renderNodeDetail: (nodeId, events, tick) => {
      const role = deriveNodeRole(events, nodeId, tick);
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-text-muted">Priority</dt>
          <dd className="font-mono text-text-primary">{priorityOf(nodeId)}</dd>
          <dt className="text-text-muted">Role</dt>
          <dd className="font-mono text-text-primary">{role}</dd>
        </dl>
      );
    },
  },

  raft: {
    id: "raft",
    title: "Raft",
    summary: "Leader election, log replication, and majority commit — composed into one algorithm.",
    description: [
      "Raft answers the same question Bully did — who's in charge — but adds a term number so any node can tell a current leader from a stale one, and requires a majority vote rather than a priority rule.",
      "Start one election manually to bootstrap the cluster — everything after that is automatic: the leader sends heartbeats, and a follower that stops hearing from it times out and starts a new election on its own.",
      "Submit an entry to the leader and watch it replicate: accepted into the leader's own log immediately, but only committed once a majority of followers have it too. Partition the leader into a minority and it can accept writes that can never commit — proof a minority can never fake a majority.",
    ],
    nodeIds: RAFT_NODE_IDS,
    links: RAFT_LINKS,
    nodePositions: RAFT_NODE_POSITIONS,
    createModule: () => createRaftModule(RAFT_NODE_IDS),
    guidedSteps: RAFT_GUIDED_STEPS,
    quizzes: RAFT_QUIZZES,
    challenges: RAFT_CHALLENGES,
    renderNodeDetail: renderRaftNodeDetail,
  },

  "fault-injection": {
    id: "fault-injection",
    title: "Fault Injection Deep-Dive",
    summary: "Compose faults against Raft — the goal is confidence under adversarial timing, not just the happy path.",
    description: [
      "This is the same Raft engine as the Raft module — same election, same replication, same commit safety — but here the point is stacking faults on faults: kill a node mid-election, delay just one vote response, duplicate a heartbeat, all in the same scenario.",
      "Predict the outcome before you run each scenario. Raft's guarantees were designed to hold under messy, adversarial timing, not just clean single-fault demonstrations — this module is where you find out whether you actually believe that.",
    ],
    // Same topology as raft — this module is a content identity over the
    // identical engine, not a new one. See docs/14-fault-injection-module-design.md.
    nodeIds: RAFT_NODE_IDS,
    links: RAFT_LINKS,
    nodePositions: RAFT_NODE_POSITIONS,
    createModule: () => createRaftModule(RAFT_NODE_IDS),
    guidedSteps: FAULT_INJECTION_GUIDED_STEPS,
    quizzes: FAULT_INJECTION_QUIZZES,
    challenges: FAULT_INJECTION_CHALLENGES,
    renderNodeDetail: renderRaftNodeDetail,
  },

  replication: {
    id: "replication",
    title: "Replication",
    summary: "One leader, three followers — sync vs. async is a choice between speed and durability.",
    description: [
      "A write only ever goes to the leader. It's applied there immediately, then replicated to every follower over the network — real latency, real faults, same as every module before this one.",
      "Async mode acknowledges a write the instant the leader accepts it — fast, but a leader crash right after can lose data a client already believes succeeded. Sync mode waits for every currently-alive follower to confirm first — durable, but a single dead follower can block every future write, with no majority escape hatch yet.",
      "Run the exact same write, under the exact same fault, in both modes — that comparison is the whole point of this module.",
    ],
    // A star, not a complete graph: followers never talk to each other,
    // only ever to the leader — a deliberate visual contrast to Election/
    // Raft's complete graphs. See docs/16-replication-module-design.md.
    nodeIds: ["leader", "f1", "f2", "f3"],
    links: [
      { id: "leader-f1", from: "leader", to: "f1", latencyTicks: 3 },
      { id: "leader-f2", from: "leader", to: "f2", latencyTicks: 3 },
      { id: "leader-f3", from: "leader", to: "f3", latencyTicks: 3 },
    ],
    nodePositions: {
      leader: { x: 300, y: 180 },
      f1: { x: 300, y: 20 },
      f2: { x: 120, y: 320 },
      f3: { x: 480, y: 320 },
    },
    createModule: () => createReplicationModule("leader", ["f1", "f2", "f3"]),
    guidedSteps: REPLICATION_GUIDED_STEPS,
    quizzes: REPLICATION_QUIZZES,
    challenges: REPLICATION_CHALLENGES,
    renderNodeDetail: (nodeId, events, tick) => {
      const role = nodeId === "leader" ? "leader" : "follower";
      const store = deriveNodeStore(events, nodeId, tick);
      const storeEntries = Object.entries(store);
      const pendingKeys = role === "leader" ? derivePendingSyncKeys(events, tick) : [];
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-text-muted">Role</dt>
          <dd className="font-mono text-text-primary">{role}</dd>
          <dt className="text-text-muted">Store</dt>
          <dd className="font-mono text-text-primary">
            {storeEntries.length === 0
              ? "empty"
              : storeEntries.map(([k, v]) => `${k}=${v}`).join(", ")}
          </dd>
          {role === "leader" && (
            <>
              <dt className="text-text-muted">Pending sync writes</dt>
              <dd className="font-mono text-text-primary">
                {pendingKeys.length === 0 ? "none" : pendingKeys.join(", ")}
              </dd>
            </>
          )}
        </dl>
      );
    },
  },

  consistency: {
    id: "consistency",
    title: "Consistency",
    summary: "Given replication + real latency, what can a client actually observe?",
    description: [
      "This is the same leader/follower engine as Replication — same star topology, same store, same async/sync write toggle. What's new is the other half of the story: reading.",
      "An eventual read answers instantly from whichever node you ask, using whatever that node's own store currently holds — which can be stale if replication hasn't caught up yet. A strong read is never stale, but only because a follower forwards it to the leader and waits for the round trip: consistency has a visible, literal latency cost.",
      "Write a value, then immediately read it back from a different follower with an eventual read — you may see the old value, or none at all, even though you just wrote it. Read the same key strongly instead, and it's always correct. That gap is the whole lesson.",
    ],
    // Identical topology/engine to Replication — this module extends
    // Replication's own reducer with a READ action rather than building a
    // second engine. See docs/18-consistency-module-design.md.
    nodeIds: ["leader", "f1", "f2", "f3"],
    links: [
      { id: "leader-f1", from: "leader", to: "f1", latencyTicks: 3 },
      { id: "leader-f2", from: "leader", to: "f2", latencyTicks: 3 },
      { id: "leader-f3", from: "leader", to: "f3", latencyTicks: 3 },
    ],
    nodePositions: {
      leader: { x: 300, y: 180 },
      f1: { x: 300, y: 20 },
      f2: { x: 120, y: 320 },
      f3: { x: 480, y: 320 },
    },
    createModule: () => createReplicationModule("leader", ["f1", "f2", "f3"]),
    guidedSteps: CONSISTENCY_GUIDED_STEPS,
    quizzes: CONSISTENCY_QUIZZES,
    challenges: CONSISTENCY_CHALLENGES,
    renderNodeDetail: renderConsistencyNodeDetail,
  },

  cap: {
    id: "cap",
    title: "CAP",
    summary: "Partition the leader away, then choose: answer anyway (stale) or refuse (unavailable).",
    description: [
      "This is the same leader/follower engine as Consistency and Replication — nothing new was built for this module, because everything CAP needs to teach already exists. Partition the leader away from the followers using the fault menu's Partition button.",
      "Now the choice is explicit. An eventual read from a cut-off follower still answers immediately — available, but frozen at whatever it last knew, possibly stale or missing something that now exists elsewhere. A strong read from that same follower forwards to the leader and simply never comes back — the follower would rather answer nothing than answer wrong.",
      "This cluster can never split-brain: there's exactly one node that ever accepts a write, partition or not. A real split-brain scenario needs a system where both sides of a partition can independently decide they're in charge — that's a question for the election-capable modules, not this one.",
    ],
    // Identical topology/engine to Replication/Consistency. The default
    // partition split (nodeIds[0] vs. the rest, from FaultInjectionMenu)
    // isolates the leader for free — no new controls needed either. See
    // docs/20-cap-module-design.md.
    nodeIds: ["leader", "f1", "f2", "f3"],
    links: [
      { id: "leader-f1", from: "leader", to: "f1", latencyTicks: 3 },
      { id: "leader-f2", from: "leader", to: "f2", latencyTicks: 3 },
      { id: "leader-f3", from: "leader", to: "f3", latencyTicks: 3 },
    ],
    nodePositions: {
      leader: { x: 300, y: 180 },
      f1: { x: 300, y: 20 },
      f2: { x: 120, y: 320 },
      f3: { x: 480, y: 320 },
    },
    createModule: () => createReplicationModule("leader", ["f1", "f2", "f3"]),
    guidedSteps: CAP_GUIDED_STEPS,
    quizzes: CAP_QUIZZES,
    challenges: CAP_CHALLENGES,
    renderNodeDetail: renderConsistencyNodeDetail,
  },

  quorum: {
    id: "quorum",
    title: "Quorum",
    summary: "Majority (3 of 4) for both reads and writes — tolerate a dead node without picking a permanent side.",
    description: [
      "Same leader/follower engine as Replication/Consistency/CAP, with one more option on each toggle: Quorum. A quorum write acknowledges once a majority of the whole cluster (3 of 4 here) has it — not every follower like sync, not just the leader like async.",
      "A quorum read works the other way: gather answers from a majority and trust whichever one has the highest version. Kill one node and everything still works — majority is still reachable. Kill a second, and both quorum writes and quorum reads stop resolving, live, in front of you.",
      "A quorum read from a follower can't ask its peers directly — this star topology only gives the leader links to everyone — so it asks the leader to coordinate on its behalf, folding in the leader's own answer for free before polling anyone else.",
    ],
    nodeIds: ["leader", "f1", "f2", "f3"],
    links: [
      { id: "leader-f1", from: "leader", to: "f1", latencyTicks: 3 },
      { id: "leader-f2", from: "leader", to: "f2", latencyTicks: 3 },
      { id: "leader-f3", from: "leader", to: "f3", latencyTicks: 3 },
    ],
    nodePositions: {
      leader: { x: 300, y: 180 },
      f1: { x: 300, y: 20 },
      f2: { x: 120, y: 320 },
      f3: { x: 480, y: 320 },
    },
    createModule: () => createReplicationModule("leader", ["f1", "f2", "f3"]),
    guidedSteps: QUORUM_GUIDED_STEPS,
    quizzes: QUORUM_QUIZZES,
    challenges: QUORUM_CHALLENGES,
    renderNodeDetail: (nodeId, events, tick) => {
      const role = nodeId === "leader" ? "leader" : "follower";
      const store = deriveNodeStore(events, nodeId, tick);
      const versions = deriveNodeStoreVersions(events, nodeId, tick);
      const storeEntries = Object.entries(store);
      const lastRead = deriveLastReadServed(events, nodeId, tick);
      const pendingQuorumKeys = role === "leader" ? derivePendingQuorumKeys(events, tick) : [];
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-text-muted">Role</dt>
          <dd className="font-mono text-text-primary">{role}</dd>
          <dt className="text-text-muted">Majority needed</dt>
          <dd className="font-mono text-text-primary">3 of 4</dd>
          <dt className="text-text-muted">Store</dt>
          <dd className="font-mono text-text-primary">
            {storeEntries.length === 0
              ? "empty"
              : storeEntries.map(([k, v]) => `${k}=${v} (v${versions[k] ?? 0})`).join(", ")}
          </dd>
          <dt className="text-text-muted">Last read served</dt>
          <dd className="font-mono text-text-primary">
            {!lastRead
              ? "none yet"
              : `${lastRead.key}=${lastRead.found ? lastRead.value : "(not found)"} (${lastRead.consistency}, by ${
                  lastRead.servedByNodeId
                }, ${lastRead.roundTripTicks} ticks)`}
          </dd>
          {role === "leader" && (
            <>
              <dt className="text-text-muted">Pending quorum writes</dt>
              <dd className="font-mono text-text-primary">
                {pendingQuorumKeys.length === 0 ? "none" : pendingQuorumKeys.join(", ")}
              </dd>
            </>
          )}
        </dl>
      );
    },
  },

  "distributed-database": {
    id: "distributed-database",
    title: "Distributed Database",
    summary: "A small key-value store built entirely from Raft — the capstone, not a new algorithm.",
    description: [
      "This is the same Raft engine as the Raft and Fault Injection modules — same election, same replication, same commit safety — with one addition: log entries now mean something. PUT encodes a key/value pair into an entry submitted to whichever node you pick; GET reads a node's own committed key-value view, derived purely from its own log and its own commit progress.",
      "GET never sends a message or changes anything — it's a pure question: \"given everything this node has committed so far, what would it answer?\" Read from the leader for the authoritative view, or from a follower to see it lag, or from a partitioned node to see it frozen in the past.",
      "Everything you already know about Raft still applies exactly as before: kill the leader mid-PUT and watch a new one take over with no data lost; partition a follower away and its own KV view simply stops moving, even while the rest of the cluster keeps committing.",
    ],
    nodeIds: RAFT_NODE_IDS,
    links: RAFT_LINKS,
    nodePositions: RAFT_NODE_POSITIONS,
    createModule: () => createRaftModule(RAFT_NODE_IDS),
    guidedSteps: DISTRIBUTED_DATABASE_GUIDED_STEPS,
    quizzes: DISTRIBUTED_DATABASE_QUIZZES,
    challenges: DISTRIBUTED_DATABASE_CHALLENGES,
    renderNodeDetail: (nodeId, events, tick) => {
      const role = deriveNodeRole(events, nodeId, tick);
      const term = deriveNodeTerm(events, nodeId, tick);
      const logLength = deriveLogLength(events, nodeId, tick);
      const ownCommitIndex = deriveNodeCommitIndex(events, nodeId, tick);
      const kvStore = deriveKvStoreForNode(events, nodeId, tick);
      const kvEntries = Object.entries(kvStore);
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-text-muted">Role</dt>
          <dd className="font-mono text-text-primary">{role}</dd>
          <dt className="text-text-muted">Term</dt>
          <dd className="font-mono text-text-primary">{term}</dd>
          <dt className="text-text-muted">Log entries</dt>
          <dd className="font-mono text-text-primary">{logLength}</dd>
          <dt className="text-text-muted">Own commit index</dt>
          <dd className="font-mono text-text-primary">{ownCommitIndex === -1 ? "none yet" : ownCommitIndex}</dd>
          <dt className="text-text-muted">KV store (own view)</dt>
          <dd className="font-mono text-text-primary">
            {kvEntries.length === 0 ? "empty" : kvEntries.map(([k, v]) => `${k}=${v}`).join(", ")}
          </dd>
        </dl>
      );
    },
  },
};

export function getModuleDefinition(moduleId: string): ModuleDefinition<unknown, unknown> | undefined {
  return MODULE_REGISTRY[moduleId];
}

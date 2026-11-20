# 10 — Module Design: Leader Election (Bully)

## Why this module, and why now

[08-module-roadmap.md](./08-module-roadmap.md) lists Leader Election as
Module 6, conceptually downstream of Replication (2), Consistency (3),
CAP (4), and Quorum (5). This document deliberately jumps ahead of that
order and builds Leader Election next, directly on top of Module 1
(Networking).

That document is explicit that its module sequence is "a *conceptual*
dependency graph, not a strict engineering build order." The Bully
algorithm specifically doesn't need majority-vote quorum reasoning to be
taught first — a node becomes leader because it is the highest-ID
*alive* node that responds to an election, not because it won a
majority vote. The only real prerequisite is Module 1's network model
(links, latency, faults), which already exists. Building this module now
is also the best available test of whether the engine/store/animation
framework generalizes to a *qualitatively different* protocol — richer
node state, multiple concurrent in-flight control messages, timers that
drive role changes — rather than just adding more content to the
networking demo.

Modules 2-5 remain unbuilt and unplanned in detail; nothing here assumes
they exist. Raft (Module 7 in the original roadmap) is the natural
follow-on once this module is done, since Raft's election phase is a
direct evolution of what's built here (adding term numbers and
majority-vote semantics on top of the same "who's in charge" question).

## Learning objectives

After this module, a learner should be able to:

1. Explain why an asynchronous system needs an explicit protocol to
   agree on a single coordinator, rather than just "the first node."
2. Trace the Bully algorithm's message flow: `ELECTION` → `OK` →
   `COORDINATOR`, and explain why a node only escalates to a higher-ID
   peer, never a lower one.
3. Predict, given a set of alive nodes, which one becomes leader (always
   the highest-ID alive node) — and verify it by running the scenario.
4. Explain what an election timeout is *for*: without one, a candidate
   that gets no `OK` response has no way to know whether it should
   proceed to declare itself leader.
5. Observe and explain a split-brain scenario: a network partition can
   cause two leaders to be simultaneously believed-valid in different
   partition groups, and this is only resolved once the partition heals
   and one side's stale leader is challenged again.
6. Name Bully's real weakness as a foreshadowing hook for Raft: there is
   no term/epoch number, so a node has no way to distinguish a *current*
   `COORDINATOR` announcement from a stale one delayed by the network.
   This module does not fix that weakness — it exists so the learner
   feels the gap before Raft closes it with term numbers.

## Simulation model

### Node priority and role

Bully requires a total order over nodes. Rather than overload node id
strings, each node gets an explicit numeric `priority` in module config
— in practice, this module's node ids *are* small integers as strings
(`"1"`, `"2"`, `"3"`, ...), read as `Number(id)` for comparison, which
matches how Bully is conventionally taught (numbered processes) and
keeps the comparison rule visible in the id itself rather than hidden in
a side table.

A node has a `role`, independent of its existing `alive`/`crashed`
status (per [04-simulation-engine.md](./04-simulation-engine.md): "the
engine core only knows about id/status; role... [is] opaque payload it
stores but does not interpret" — this module is the first real use of
that stated generality):

```ts
type ElectionRole = "follower" | "candidate" | "leader";
```

- `follower`: default state; not currently running or part of an
  election.
- `candidate`: has sent `ELECTION` messages to higher-priority nodes and
  is waiting for a response.
- `leader`: has either received no `OK` within its election timeout (and
  so declared itself), or has been told who the leader is via a
  `COORDINATOR` message.

### Topology

Unlike Module 1's arbitrary link graph, Bully requires every node to be
able to message every other node directly (an election message may need
to reach any higher-priority peer). The module registry entry for
`election` configures a **complete graph** over its node ids — this is a
config choice (all pairwise `LinkConfig` entries), not a new engine
capability.

### Messages: reusing the network transport, not reinventing it

`ELECTION`, `OK`, and `COORDINATOR` are transported exactly like Module
1's pings — same `messageSentEvent` / `messageDeliveredEvent` /
`messageDroppedEvent`, same `NetworkModel` latency/drop-rate/partition
handling, same `DELIVER_MESSAGE`-style scheduled timer. The only
addition is a `kind` field on the message payload:

```ts
type ElectionMessageKind = "election" | "ok" | "coordinator";
```

This is a deliberate validation of the architecture: Module 1's message
lifecycle was built generically enough that a second module's entire
control-plane protocol rides on it unmodified. `PacketDot`,
`useEventAnimations`, the inspector's message detail view, and every
existing fault (kill node, drop/reorder/duplicate, partition) apply to
election traffic for free — nobody has to reimplement "what happens if
an `ELECTION` message is dropped," because it's the same drop mechanism
Module 1 already has, and the Bully reducer only has to correctly handle
"this message never arrived" the same way any correct implementation
would.

### Module-owned events

Role changes and election lifecycle are semantically specific to this
module, so they live in `src/modules/election/electionEvents.ts` (not
the shared `src/simulation/events/`), per
[02-folder-structure.md](./02-folder-structure.md)'s existing note that
module-specific events like a hypothetical `raftEvents.ts` belong beside
the module, not in the shared folder:

- `ELECTION_STARTED { nodeId, reason: "manual" | "no-coordinator-timeout" }`
- `NODE_ROLE_CHANGED { nodeId, role: ElectionRole }`
- `LEADER_ELECTED { nodeId }` (redundant with a `NODE_ROLE_CHANGED` to
  `"leader"`, but kept as its own event because "who is the leader right
  now" is checked often enough — by guided steps, challenges, and the
  inspector — to deserve a direct, unambiguous event type rather than
  requiring every consumer to scan for the latest role change)

### Reducer actions

```ts
type ElectionAction =
  | { type: "START_ELECTION"; nodeId: string }
  | { type: "KILL_NODE"; nodeId: string }        // reused verbatim from networking
  | { type: "PARTITION_NETWORK"; groups: string[][] } // reused verbatim
  | { type: "HEAL_PARTITION" };                   // reused verbatim
```

`START_ELECTION` is a manual, explicit command — like `KILL_NODE`, it is
something the learner triggers, not something the engine infers from a
heartbeat timeout. Automatic failure detection (a node noticing its
leader stopped responding and starting an election on its own) is
explicitly **out of scope for this module**: it would require a
heartbeat/liveness sub-protocol that adds complexity without adding to
the core lesson (the shape of the election itself), and it can be added
later as a "future considerations" item if a lesson concretely needs it.
`KILL_NODE`/`PARTITION_NETWORK`/`HEAL_PARTITION` are imported and reused
unchanged from the networking module — this module does not redefine
fault primitives, which is exactly the payoff
[04-simulation-engine.md](./04-simulation-engine.md) promised ("every
module gets fault injection for free").

### Election algorithm (behaviors)

On `START_ELECTION` for node `P` (must be alive):

1. `P` becomes `candidate`, emits `ELECTION_STARTED`, `NODE_ROLE_CHANGED`.
2. `P` sends an `ELECTION` message to every alive node with higher
   priority. If there are none (P is already the highest alive node), P
   skips straight to step 4 (self-declares immediately — no need to wait
   out a timeout when there's nobody who could outrank it).
3. `P` schedules an `ELECTION_TIMEOUT` timer. If it fires before any `OK`
   arrives, `P` proceeds to step 4.
4. `P` becomes `leader`, emits `LEADER_ELECTED`/`NODE_ROLE_CHANGED`,
   sends `COORDINATOR` to every other alive node.

On receiving an `ELECTION` message at node `Q` (from a lower-priority
node):

1. `Q` replies `OK` to the sender.
2. If `Q` is not already a `candidate`, `Q` starts its own election
   (step 2 above, addressed to nodes higher than `Q`) — this is what
   makes the election "bubble up" to the true highest-priority alive
   node, rather than stopping at the first responder.

On receiving an `OK` message at a `candidate` node:

1. Cancel the pending `ELECTION_TIMEOUT`.
2. Schedule a `COORDINATOR_TIMEOUT`. If no `COORDINATOR` message arrives
   before it fires, restart the election from step 2 — the higher node
   that answered `OK` may since have crashed or been partitioned away,
   and Bully has no other way to detect that than "I was told to wait,
   and nobody eventually told me who won."

On receiving a `COORDINATOR` message at any node:

1. Cancel any pending timeout.
2. Adopt `role: "follower"` and record the sender as leader (this
   module does not track "who do I think the leader is" as a separate
   field beyond role + the `LEADER_ELECTED` event log — a fuller
   `currentLeaderId` per-node field is unnecessary until a lesson
   needs a node to explicitly act on "who's my leader," which doesn't
   happen in this module's scope).

All of the above timers reuse the existing declarative `schedule`
channel on `ReduceResult` (same mechanism Milestone 5's
`DELIVER_MESSAGE` timer already established) — no engine change is
needed to support `ELECTION_TIMEOUT`/`COORDINATOR_TIMEOUT` as new timer
payload kinds handled by this module's own `onTimer`.

### Split-brain scenario (why this module matters for the Raft foreshadowing)

If the network is partitioned before an election starts, each partition
group runs its own independent Bully election using only the nodes it
can see — because from inside a partition, an unreachable higher-priority
node is indistinguishable from a crashed one (a deliberate, correct
property of the network model, not a bug). This can produce two
simultaneous `leader`-role nodes, one per partition. Healing the
partition does **not** automatically resolve this — no automatic
re-election is triggered by a heal event in this module's scope, matching
"nothing animates unless something really happens": the learner must
manually trigger a new election to see the conflict actually get
resolved, and observing that Bully alone doesn't self-heal this is the
point.

## UI additions

### Node visuals

`NodeGlyph` needs an optional role indicator, additive to its existing
crashed/alive/selected states, driven by a new `deriveNodeRole` hook
(parallel to the existing `useNodeStatus`/`deriveNodeStatus`, scanning
`NODE_ROLE_CHANGED` events the same way `deriveNodeStatus` scans
`NODE_CRASHED`). Modules with no such events (Networking) simply never
produce a non-`"follower"` role, so the visual is inert there — no
per-module branching inside `NodeGlyph` itself.

Visual language, consistent with the existing shape+color (not
color-only) rule from [03-design-system.md](./03-design-system.md):

- `leader`: solid amber ring + a small crown glyph (Lucide `Crown`),
  distinguishable from the existing amber "selected" ring by the crown
  icon being present regardless of selection state.
- `candidate`: dashed sky-blue ring, pulsing only if
  `!prefersReducedMotion` (reusing the M14 hook).
- `follower`: unchanged existing default node visual.

### Inspector

`NodeInspector` currently shows only the generic `id`/`status` fields
common to every module. This module is the first real second caller for
"module-specific node detail," which
[09-implementation-roadmap.md](./09-implementation-roadmap.md)'s
Milestone 7 explicitly deferred ("Module-specific state renderers... —
deferred until Module 7 exists; for now the inspector shows generic
node/message fields only, since that's all any module has yet.").

Rather than building a general plugin/renderer system now (that would
be designing for hypothetical future modules before a second concrete
shape is known), `ModuleDefinition` gains one optional field:

```ts
renderNodeDetail?: (nodeId: string, events: readonly SimEvent[], tick: Tick) => ReactNode;
```

`NodeInspector` calls it if present and renders the result below the
generic fields. The election module's implementation shows `priority`
(parsed from the id) and current `role` (via `deriveNodeRole`). This is
the smallest addition that unblocks a real need without generalizing
further than this one concrete case demands.

### Required framework generalization: `ModuleDefinition`

`moduleRegistry.ts`'s `ModuleDefinition` is currently typed concretely
against `NetworkingState`/`NetworkingAction` (`createModule: () =>
SimulationModule<NetworkingState, NetworkingAction>`), noted in its own
comment as deliberate: "Only one real module exists so far... that
generalization is worth doing once a second, differently-shaped module
... actually needs it." This module is that second caller. The fix is
mechanical — parameterize `ModuleDefinition<State, Action>` and have
`MODULE_REGISTRY` hold `ModuleDefinition<unknown, unknown>` (or a
per-entry existential via a small helper), since nothing outside the
module needs to know the concrete `State`/`Action` shape — the page,
store, and generic components only ever call through
`SimulationModule<State, Action>`'s already-generic interface. This is a
type-level change only; no runtime behavior changes.

### Guided lessons (planned; final copy written during content-pass milestone)

1. Trigger an election from the lowest-priority node; observe it bubble
   all the way up and the highest-priority node become leader.
2. Kill the current leader; trigger a new election from any surviving
   node; observe the next-highest-priority alive node wins.
3. Kill the two highest-priority nodes before electing; observe the
   third-highest becomes leader — reinforcing "highest *alive*," not
   just "highest."
4. Partition the highest-priority node away from everyone else, then
   trigger an election inside the majority group; observe a leader is
   elected that would not have won had the partitioned node been
   reachable — the split-brain lesson.
5. Heal the partition from step 4; observe nothing changes automatically
   until a new election is manually triggered.

### Challenges (planned)

- Cause a leader to be elected without directly starting the election on
  the eventual leader itself (must go through at least one bubble-up
  hop).
- Cause two different nodes to simultaneously hold `role: "leader"` at
  the same tick (the split-brain challenge).
- Cause an election to restart via `COORDINATOR_TIMEOUT` (kill the
  responding higher node after its `OK` but before its `COORDINATOR`).

### Predictive quiz (planned)

- "Given nodes 1-5 alive, election started at node 2 — who becomes
  leader?" (predict before running)
- "Node 5 (leader) is partitioned away. Node 3 starts an election. Who
  becomes leader, and what happens when the partition heals?"

## Non-goals for this module

- Term/epoch numbers, log replication, quorum/majority-vote leader
  confirmation — these are Raft's contribution and are deliberately
  absent here; the module's explanation content calls out Bully's
  resulting weakness explicitly rather than silently working around it.
- Automatic failure detection (heartbeat-driven election triggering) —
  elections are always learner-triggered commands, consistent with how
  every other fault in this platform is an explicit, inspectable action.
- A general inspector plugin/renderer system — one optional
  `renderNodeDetail` hook is added, sized to this module's actual need.
- Any change to `src/simulation/engine/**` — nothing here requires a new
  engine capability; `schedule`/`networkPatch` already cover every
  mechanism this module needs.

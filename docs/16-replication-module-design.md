# 16 — Module Design: Replication

## Why this module, and why now

Per [08-module-roadmap.md](./08-module-roadmap.md), Module 2 was always
meant to come right after Networking: "Leader/follower roles introduced
for the first time; a write on the leader gets copied to followers.
Sync vs. async replication as a configurable toggle, so the learner can
directly compare (same write, same fault) under both." Election and
Raft were built first instead (a deliberate, explicitly-flagged
deviation each time); this module now fills the gap those two jumped
over.

The key design constraint is the opposite of Raft's: **deliberately
simpler**. Raft already contains a full, correct implementation of
replication + majority commit — but bundled with leader election and
term numbers, which would bury the one concept this module exists to
isolate. Module 2 has:

- **No election.** The leader is a fixed, static assignment for the
  whole session — there is no failover mechanism, and none is needed;
  that's Modules 6/7's job, already built.
- **No majority/quorum.** "Sync" here means "wait for every currently
  alive follower," not "wait for a majority" — the quorum generalization
  is explicitly Module 5's contribution, not this module's.
- **No client reads / consistency semantics.** This module only proves
  replication happens and durability differs by mode; "what can a
  client actually observe" (staleness, reading from different
  replicas) is Module 3's job.

Every one of these is a real concept this module is *setting up*, not
solving — each is called out below as an explicit non-goal so a future
module's design doc doesn't have to re-litigate why it's there.

## Learning objectives

After this module, a learner should be able to:

1. Explain the leader/follower split: writes only ever go to the
   leader; followers only ever receive replicated copies.
2. Trace a write end to end: accepted into the leader's own store
   immediately, then replicated to each follower over the network
   (real latency, real faults — same transport every prior module used).
3. Explain the durability tradeoff **sync vs. async** replication makes
   concrete: async acknowledges a write the instant the leader accepts
   it (fast, but a leader crash right after can lose data a client
   already believes succeeded); sync only acknowledges once every
   currently-alive follower has confirmed it (durable, but a single
   dead follower can block every future write).
4. Run the *same* write, under the *same* fault, in both modes, and see
   the difference directly — the roadmap's explicit framing for this
   module — rather than being told about the tradeoff abstractly.
5. Predict the harsh edge case sync mode implies: if a follower is down
   when a sync write is submitted, that write can never acknowledge
   until the follower comes back (there is no majority escape hatch
   yet) — a direct, felt motivation for why Module 5 (Quorum) exists.

## Simulation model

### Topology: a star, not a complete graph

Unlike Election/Raft (which need every node to reach every other node),
replication only ever flows leader↔follower — followers never talk to
each other. The topology is a **star**: one link per follower, all
through the leader. This is a deliberate, visible contrast on the
canvas from the complete graphs of the prior two modules, reinforcing
"this algorithm's communication pattern is genuinely different."

Four nodes: `"leader"`, `"f1"`, `"f2"`, `"f3"` — chosen so the canvas
label itself (already just the uppercased node id, per
`SimulationCanvas.tsx`) reads "LEADER" / "F1" / "F2" / "F3" with zero
new labeling mechanism. Role is a **static** fact for the whole session
(no election), so there's no need for Election/Raft's event-derived
role visuals (crown, pulsing ring) here — reusing that machinery for a
fact that never changes would be solving a problem this module doesn't
have. The static role is shown via the id-derived label and the
inspector; `NodeGlyph` needs no changes.

### Node state

```ts
interface ReplicationNodeState {
  id: string;
  status: "alive" | "crashed"; // reused verbatim
  role: "leader" | "follower"; // static for the session — set at init, never changes
  store: Record<string, string>; // this node's own view of the data — deliberately kept
                                   // (rather than derived later) so Module 3 (Consistency)
                                   // can read "what does node X think key K equals" for free
}
```

### Module-level state

```ts
interface ReplicationState {
  nodes: Record<string, ReplicationNodeState>;
  messages: Record<string, Message>;
  nextMessageId: number;
  mode: "sync" | "async"; // a toggle, not per-write — see "Sync vs. async" below
  // For a write still waiting on sync acknowledgment: which alive
  // followers (at write time) still haven't confirmed.
  pendingSyncWrites: Record<string, { key: string; value: string; awaiting: string[] }>;
}
```

### Reducer actions

```ts
type ReplicationAction =
  | { type: "SET_REPLICATION_MODE"; mode: "sync" | "async" }
  | { type: "WRITE"; nodeId: string; key: string; value: string } // rejected as a no-op if nodeId isn't the leader
  | { type: "KILL_NODE"; nodeId: string }
  | { type: "SET_LINK_CONFIG"; from: string; to: string; latencyTicks?: number; dropRate?: number }
  | { type: "PARTITION_NETWORK"; groups: string[][] }
  | { type: "HEAL_PARTITION" }
  | { type: "DROP_MESSAGE"; messageId: string }
  | { type: "REORDER_MESSAGE"; messageId: string; delayTicks: number }
  | { type: "DUPLICATE_MESSAGE"; messageId: string };
```

`SET_REPLICATION_MODE` is a **toggle**, not a per-write parameter — the
roadmap's own language ("a configurable toggle") and the "same write,
same fault, under both" comparison only make sense if a learner sets
the mode once, runs a scenario, flips it, and reruns the *same*
scenario. The five fault actions are reused verbatim from the pattern
every prior module established (`KILL_NODE`/`SET_LINK_CONFIG`/
`PARTITION_NETWORK`/`HEAL_PARTITION` from Election/Raft's precedent,
`DROP_MESSAGE`/`REORDER_MESSAGE`/`DUPLICATE_MESSAGE` from Raft's
Milestone 26 addition) — no new fault kind, same as every module since
Networking.

### Messages

Same transport, same `kind`-tagged payload pattern Election/Raft
established:

```ts
type ReplicationMessageKind = "replicate" | "replicate-ack";
```

- `replicate` (leader → follower): `{ key, value }`
- `replicate-ack` (follower → leader): `{ key, value }` — only ever sent
  in **sync** mode; async replication is fire-and-forget, since nothing
  needs to wait on it.

### Module-owned events

- `WRITE_ACCEPTED { nodeId, key, value, mode }` — the leader accepted a
  write into its own store. Fired immediately, regardless of mode.
- `WRITE_REPLICATED { nodeId, key, value }` — a follower applied a
  replicated write to its own store.
- `WRITE_ACKNOWLEDGED { key, value }` — the write is now durable per the
  mode active when it was submitted: fired **immediately** (same tick)
  after `WRITE_ACCEPTED` for async; fired only once every follower that
  was alive at write time has replicated it, for sync.

### Sync vs. async semantics (the core mechanic)

On `WRITE` (leader only, rejected as a no-op otherwise — same no-op
precedent as every prior module's invalid-target commands):

1. Apply to the leader's own `store` immediately; emit `WRITE_ACCEPTED`.
2. Send a `replicate` message to every **alive** follower (dead ones are
   simply skipped — a message to a follower that's already gone isn't
   informative, same reasoning Bully/Raft's `otherAliveNodeIds` already
   established).
3. **Async**: emit `WRITE_ACKNOWLEDGED` in this same reduce call,
   immediately. Followers apply the write whenever their `replicate`
   message happens to arrive — the client-visible "success" already
   happened before that, which is exactly the risk async mode teaches.
4. **Sync**: record `pendingSyncWrites[key] = { key, value, awaiting:
   [alive follower ids] }`. No acknowledgment yet.

On `replicate` delivered (follower): apply to the follower's own
`store`; emit `WRITE_REPLICATED`; if the current mode is sync (checked
via the message, not the node's own possibly-stale view — the message
doesn't need to carry mode explicitly, since only sync writes ever
produce a `replicate-ack` reply), reply with `replicate-ack`.

On `replicate-ack` delivered (leader): remove the acking follower from
`pendingSyncWrites[key].awaiting`; once empty, emit
`WRITE_ACKNOWLEDGED` and clear the pending entry.

This means a **sync write submitted while a follower is down never
resolves** — there is no timeout, no majority escape hatch, nothing
that unblocks it short of that follower coming back (or the learner
manually working around it, which Module 5 doesn't exist yet to teach).
This is the harsh, honest consequence the design doc's learning
objectives call out — not a bug, and not softened.

## UI additions

### Node visuals

None needed — see "Topology" above: role is static, shown via the
already-uppercased id label, not via new event-driven visuals.

### Inspector

`renderNodeDetail` shows: `role`, and this node's own `store` as
key→value pairs (directly answering "what does this node currently
think the data is," which is the exact question Module 3 will later
complicate). For the leader specifically, also show any
`pendingSyncWrites` still awaiting acknowledgment, so a learner can see
*why* a sync write is stuck without needing to count packets by hand.

### Controls

A small `ReplicationControls` component (same temporary-trigger
precedent as `ElectionControls`/`RaftControls`): a sync/async toggle,
a key/value input pair, and a "Write" button that dispatches `WRITE` to
the (only) leader node — no node-selection step needed, unlike
Election/Raft's controls, since there's exactly one possible target.

### A pre-existing stray control, found during this module's design research

`SimulationCanvas.tsx` has a leftover debug `Panel` with a hardcoded
"Send Ping" button dispatching `SEND_PING` from `definition.nodeIds[0]`
to `[1]` — mounted unconditionally for **every** module, including
Election/Raft/Fault-Injection today (where it's a harmless no-op
thanks to the Milestone 23 defensive `default` case, just a confusing
dead button). This predates the per-module `*Controls` component
pattern (`ElectionControls`, `RaftControls`) and should be removed as
part of this module's UI milestone — not new scope, just cleanup of
something this module's own control component would otherwise sit
awkwardly alongside.

## Guided lessons (planned; final copy written during content-pass milestone)

1. In async mode, write a key on the leader; watch it replicate to all
   three followers; note `WRITE_ACKNOWLEDGED` fired instantly, before
   any follower had actually received it.
2. Switch to sync mode, write a different key; watch
   `WRITE_ACKNOWLEDGED` wait until all three `replicate-ack` messages
   arrive.
3. In async mode, kill a follower, then write — the write is
   acknowledged instantly regardless; that follower's copy is simply
   gone/stale forever (no recovery mechanic, same as every prior
   module).
4. In sync mode, kill a follower, then write — the write is accepted by
   the leader but never acknowledges; check the inspector's pending-acks
   list to see exactly why.
5. Repeat the *same* write/fault pair from steps 3-4 side by side
   (async then sync, or vice versa) to directly compare the two modes'
   behavior under identical conditions — the roadmap's explicit framing
   for this whole module.

## Challenges (planned)

- Cause a write to be acknowledged before every follower has it (async
  mode, easy — but must be verified via the event log, not assumed).
- Cause a sync write to become permanently stuck (kill a follower
  before it acks).
- Cause the exact same write to resolve differently under sync vs.
  async against the same fault (the comparison challenge).

## Predictive quiz (planned)

- "You kill a follower, then submit a write in async mode. Does the
  write get acknowledged?" (Yes — immediately, regardless of the dead
  follower.)
- "You kill a follower, then submit a write in sync mode. Does the
  write get acknowledged?" (No — never, until that follower returns,
  which isn't possible in this session.)

## Non-goals (explicitly deferred)

- Leader election/failover — Modules 6/7's job, already built.
- Majority/quorum-based acknowledgment — Module 5's job.
- Client reads, staleness, read-your-writes — Module 3's job. This
  module keeps each node's `store` visible in the inspector specifically
  so Module 3 can build on it without changing this module's shape.
- Any new fault kind — reuses the full existing fault set unchanged.

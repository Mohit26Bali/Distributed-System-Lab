# 22 — Quorum Module Design

## Where this sits

Per [08-module-roadmap.md](./08-module-roadmap.md), Module 5 — Quorum —
is the general mechanism for tolerating the Module 4 (CAP) tradeoff
without permanently picking one side: instead of "all followers" (sync)
or "just the leader" (strong read), a majority of the cluster is enough
for both a write to be durable and a read to be correct. This is also
where the roadmap's own success criterion — "kill nodes until it stops
working" — genuinely lands for the first time: with a 4-node cluster
(1 leader + 3 followers, majority = 3), killing one node still leaves
quorum; killing a second breaks it, live, in front of the learner.

## Still the same engine, extended twice more

Same identity-over-Replication's-engine pattern as Consistency and CAP,
but unlike CAP, this module needs two genuinely new mechanics (not
zero, not a reuse of an existing one) — the topology stays identical
(`leader`, `f1`, `f2`, `f3`, star), so majority is fixed at 3 of 4 for
the whole module, not a configurable W/R slider. A general
configurable-quorum-size UI is deliberately out of scope (see Non-goals)
— the fixed 3-of-4 case is sufficient to teach the concept and matches
this project's habit of not building configuration UI nothing currently
needs (same reasoning `FaultInjectionMenu`'s fixed partition split and
reorder delay already use).

### 1. Quorum writes — a third `ReplicationMode`

`ReplicationMode` grows from `"sync" | "async"` to `"sync" | "async" |
"quorum"`. A quorum write behaves exactly like today's sync write
(leader applies locally, sends `replicate` to every alive follower) but
acknowledges once **a majority** of the cluster (leader + acking
followers) has confirmed, not literally every alive follower. This
reuses the entire existing `replicate`/`replicate-ack` message pipe —
only the resolution threshold differs. A new `pendingQuorumWrites:
Record<string, { key: string; value: string; ackedBy: string[];
required: number }>` map sits alongside the existing
`pendingSyncWrites`, purely additive so sync's own shipped behavior is
untouched.

### 2. Quorum reads — a new fan-out/reconcile mechanic

This is the genuinely new piece. A quorum read can't just forward to
one authority (the leader, as strong reads do) — it has to ask a
majority of the cluster and pick the most recent answer among however
many replicas disagree. That requires:

- **Per-node write versions**: a new `storeVersions: Record<nodeId,
  Record<key, number>>` in `ReplicationState`, incremented on the
  leader each time `WRITE` is dispatched (regardless of value —
  `version` is a write counter, not a content hash) and carried on the
  `replicate` message so a follower records the version it actually
  received, not necessarily the latest one that exists. This is
  additive to state — it does not change the existing `store:
  Record<string, string>` shape any other module reads.
- **Fan-out/collect bookkeeping, coordinated by the leader**: this star
  topology gives only the leader direct links to every node — followers
  have no link to each other at all. So a quorum read from the leader
  itself fans out directly (it can reach everyone), but a quorum read
  from a FOLLOWER can't fan out on its own; it instead asks the leader
  to coordinate one on its behalf via a new `quorum-coordinate-request`/
  `quorum-coordinate-response` message pair, with the requester's own
  local (value, version) riding along on the request so the leader
  counts it as a response without an extra wasted hop. The leader adds
  its own local answer as a second, and if that's already a majority,
  resolves immediately; otherwise it fans out `quorum-read-forward`/
  `quorum-read-response` (riding the same transport as every other
  kind) to the remaining followers via `pendingQuorumReads:
  Record<string, { key: string; initiatorNodeId: string; responses:
  Array<{ nodeId: string; value?: string; version: number; found:
  boolean }>; required: number }>`. Once `responses.length` reaches the
  majority, the response with the highest version wins (ties resolved
  by whichever arrived first) and the leader relays the answer back to
  the original requester, which fires `READ_SERVED` with a third
  `ConsistencyLevel` value, `"quorum"`. A quorum read issued by the
  leader itself never needs any of this — its own copy is always at
  least as current as anything a quorum could produce, so it answers
  immediately, same shortcut as a strong read on the leader.

If too many nodes are dead to ever reach a majority of responses, the
read just never resolves — same no-timeout precedent as sync writes and
strong reads. This is the module's own version of "kill nodes until it
stops working": the learner discovers the exact node count at which
quorum reads/writes stop being possible, live.

## Why not configurable W/R quorums

A general "W acks out of N, R replicas out of N, with W+R>N" model is
the textbook-general version of this concept, but it adds a
configuration surface (two sliders, a correctness precondition to
explain) this module's single lesson doesn't need: majority-for-both is
sufficient to demonstrate "kill nodes until it breaks," which is the
actual target experience from the roadmap. If a future module ever
needs the fully general form, this is a natural, explicitly-named place
to extend from — but building it now would be scope the current lesson
doesn't ask for, matching this project's repeated practice of not
generalizing ahead of an actual teaching need.

## Non-goals

- No configurable quorum size (W/R sliders) — fixed majority (3 of 4),
  per above.
- No per-value vector clocks or causal metadata — a single monotonically
  increasing per-key version counter is enough to pick "most recent" in
  this module's demonstrations, and matches the project's existing
  precedent of not modeling causal/session guarantees (Consistency's
  own non-goals list the same boundary).
- No automatic conflict resolution beyond "highest version wins" — no
  last-writer-wins-by-timestamp, no application-level merge. If two
  responses somehow carry the same version (shouldn't happen given the
  leader is the sole writer and versions are assigned there), first-
  received wins, deterministically, but this is not expected to occur
  in any reachable scenario given the single-writer topology.
- No quorum-based leader selection/failover — this module still has one
  fixed leader for the whole session, same as Replication/Consistency/
  CAP. Quorum here is about read/write durability and correctness, not
  about picking who's in charge (that's Modules 6-7).
- No timeout/retry on a quorum read or write that can't reach majority —
  same "no escape hatch" precedent as every prior module's stuck-write/
  hung-strong-read behavior.

## UI additions

- `QuorumControls` (new): same Write inputs as `ConsistencyControls`,
  plus a mode selector now spanning three options (Async / Sync /
  Quorum) rather than two, and a Read section with a consistency
  selector now spanning three options (Eventual / Strong / Quorum).
  Node selector for reads reused as-is.
- Inspector: extend the shared `renderConsistencyNodeDetail` (or a
  variant) to show each node's per-key version where relevant, and the
  cluster-wide majority threshold (a static "3 of 4" label, not
  per-node data) so the learner can see at a glance how many alive
  nodes are needed.

## Content plan

- **Guided steps**: a quorum write acknowledging with one follower
  dead (majority still reachable); a quorum write that never
  acknowledges once two followers are dead (majority broken, live); a
  quorum read reconciling two followers with different versions and
  picking the newer one; a quorum read that never resolves once
  majority is unreachable.
- **Quiz**: at least one "how many more nodes can die before quorum
  breaks" reasoning question, resolved via the same bounded-signal
  pattern (an unrelated read/write as the "confirm time passed" proof)
  used throughout Replication/Consistency/CAP.
- **Challenges**: cause a quorum write to succeed despite a dead
  follower; cause one to hang by killing a second; cause a quorum read
  to return a genuinely reconciled (not-most-recently-written-to-that-
  specific-node) value.

## Testing strategy

Reducer/behavior tests for quorum-write threshold resolution (majority
reached vs. not, exact node-count boundary), quorum-read fan-out/
reconcile (version comparison, tie-break, majority-unreachable hang),
and interaction with existing faults (kill/partition/drop applied to
quorum's own new message kinds) — same rigor as every prior engine
milestone. Content tests and the standard lint/build/route-smoke-test
cycle follow the established shape. Manual browser verification remains
unavailable in this environment, as always.

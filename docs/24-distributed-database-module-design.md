# 24 — Distributed Database Module Design

## Where this sits

Per [08-module-roadmap.md](./08-module-roadmap.md), Module 9 — Distributed
Database — is the capstone: a small multi-node key-value store built from
the primitives already taught, with a client the learner can issue
reads/writes from directly and watch the whole stack react. It is
explicitly "less a new concept, more an integration exercise" — the goal
is proving the earlier modules composed into something real, not
teaching anything new in isolation.

## Engine choice: Raft, not Replication

Unlike Consistency/CAP/Quorum (which all extended Replication's simple
fixed-leader star), the capstone reuses **Raft's** engine and 5-node
complete-graph topology — same precedent as Fault Injection reusing Raft
verbatim. This is the right base because a real key-value store needs
the thing only Raft has: an actual elected leader that can fail over,
term-based safety, and majority-committed log entries — not a
permanently fixed leader with no election. The lesson this module
teaches is "you already know all these pieces individually; here they
are, doing something a client would actually use them for."

## What's genuinely new vs. what's reused

**Reused as-is**: leader election, heartbeats, `SUBMIT_ENTRY`, log
replication, majority commit safety — none of this changes. Killing the
leader mid-write, partitioning it into a minority, all of Raft's and
Fault Injection's existing lessons still apply unmodified.

**New: log entries get real content.** Today, `LogEntry.value` is
described in `raftState.ts` as "an opaque label — no real state machine
needed to teach commit safety." That was correct for Raft's own lesson
(commit safety doesn't care what the payload means), but a key-value
store needs entries to actually mean something. The client's `PUT key
value` action submits a `SUBMIT_ENTRY` whose `value` is encoded as a
simple `"key=value"` string — no new action type, just a convention on
top of the existing one.

**Engine gap this exposes (real, not hypothetical): `LOG_ENTRY_APPENDED`
doesn't carry the entry's value.** Checking `raftEvents.ts` directly:
`LogEntryAppendedPayload` is `{ nodeId, index, term }` — the actual
`value` a node appended only ever lives in that node's in-memory `log`
array, never in the committed event log. Every other module's
convention is "everything visible is derived from events, never read
off engine state directly" (`docs/04-simulation-engine.md`), so as it
stands, a KV store's *contents* would be un-derivable — silently
breaking the one convention this entire project depends on the moment
someone tries to build a state machine on top of Raft's log. Fixed by
adding `value: string` to `LogEntryAppendedPayload` — purely additive,
no existing consumer reads a `value` field there today, so no shipped
Raft/Fault-Injection code changes behavior.

**Engine gap this exposes (real, not hypothetical): `LOG_ENTRY_COMMITTED`
has no `nodeId`.** It's emitted once, globally, only when the *leader's*
own `tryAdvanceCommitIndex` runs — `deriveCommittedThroughIndex`'s own
doc comment already admits "a given follower's own local commitIndex can
lag slightly behind this." Checking `raftBehaviors.ts` confirms it: a
follower silently advances its own `commitIndex` field on `AppendEntries`
delivery (`newCommitIndex` local to that handler) with **no event at
all** — engine state changing with nothing in the log to show for it.
This has been true since Raft's own Milestone 22 and never mattered
before, because nothing needed to know a specific follower's own
commit progress. The capstone's whole point — read from any node,
including a lagging one, and see it disagree — needs exactly that.
Fixed by giving `LogEntryCommittedPayload` a `nodeId` field and emitting
it from **both** sites: the leader's existing `tryAdvanceCommitIndex`
(nodeId = the leader) and the follower's `AppendEntries`-handling branch
in `raftBehaviors.ts` (nodeId = that follower), whenever its local
`commitIndex` actually advances. `deriveCommittedThroughIndex` keeps
working (compute the max across all nodes' commits, same "cluster-wide"
meaning it has today) alongside a new per-node `deriveNodeCommitIndex`.
Existing Raft/Fault-Injection tests that assert on `LOG_ENTRY_COMMITTED`
payloads need a one-line update to expect `nodeId`, nothing behavioral.

**New: KV store derivation.** A new hook,
`deriveKvStoreForNode(events, nodeId, tick)`, reconstructs a specific
node's own view of the key-value store: take that node's own
`LOG_ENTRY_APPENDED` entries (its own log, in index order — a node's log
never gets truncated/rewritten in this engine's simplified model, so
"appended" entries are stable once logged) up through that node's own
locally-known commit index (from the now-per-node
`LOG_ENTRY_COMMITTED`), parse each committed entry's `"key=value"`
string, and apply them in order. This is deliberately **per-node**, not
a single shared value — the whole point is that a partitioned-away
follower's own KV view can lag the cluster's true committed state,
exactly like Consistency's `deriveNodeStore` already does for
Replication, but built on Raft's real commit progression instead of a
simpler ack-counting scheme.

## Derivation invariant

A node's derived KV store is a pure function of exactly two things: that
node's own `LOG_ENTRY_APPENDED` events and that node's own (per-node,
after this milestone) `LOG_ENTRY_COMMITTED` events — nothing else. In
particular, `deriveKvStoreForNode` must never read a node's in-memory
`log`/`commitIndex` fields directly, no matter how tempting that
shortcut looks once both are sitting right there in `RaftState`. This is
worth stating explicitly, even though it just restates the project's
standing "everything derives from events" rule, because the KV store is
the first derived view stateful enough that reaching into engine state
directly would still "work" during manual testing while quietly
breaking scrubbing, replay, and every other tick-indexed view this
project depends on.

## Client interface

- **PUT** `{ key, value }`: submits `SUBMIT_ENTRY` to whichever node the
  learner has selected, encoded as `"key=value"`. Same rejection
  behavior as today if that node isn't the leader — no auto-routing to
  the leader, since "you have to know who the leader is" is itself part
  of the lesson every prior Raft/Election guided step already teaches.
- **GET** `{ key, fromNodeId }`: purely a derived read, no dispatch,
  computed via `deriveKvStoreForNode` — read from the leader for the
  authoritative answer, or from a follower to see it lag or (during a
  partition) freeze entirely.

## Non-goals

- No new consensus mechanics — Raft's election/replication/commit rules
  are used completely unmodified.
- No delete/range queries/transactions — `PUT`/`GET` on single keys is
  enough to prove the integration; a richer command set adds surface
  area with no new lesson.
- No automatic client-side leader discovery/retry — consistent with
  every prior module's "no escape hatch" precedent, and because
  "finding the leader yourself" is precisely what the Election/Raft
  modules already taught how to observe.
- No new fault-injection behavior — `FaultInjectionMenu`'s existing
  kill/partition/drop/reorder/duplicate apply unmodified, exactly as
  they already do for Raft and Fault Injection.

## Content plan

- **Guided steps**: `PUT` a key on the leader and watch it commit; `GET`
  the same key from a follower and see it match once caught up; kill
  the leader mid-`PUT`, elect a new one, and confirm the KV store
  survived (proving the whole stack, not just the log, survived a
  failover); partition a follower away, `PUT` more keys, and `GET` from
  the cut-off follower to see its KV view frozen in the past.
- **Quiz**: reasoning about whether a `GET` from a specific node will
  reflect a `PUT` that just committed elsewhere, resolved via the same
  bounded-signal conventions used throughout.
- **Challenges**: cause a `GET` to return a stale value from a lagging
  follower; survive a leader failure with no data loss; cause a `PUT` to
  a non-leader to be correctly rejected.

## Testing strategy

Raft engine changes (the two payload extensions) get direct unit tests
in `raft.test.ts` alongside the existing suite (per-node
`LOG_ENTRY_COMMITTED`, `value` present on `LOG_ENTRY_APPENDED`), plus a
pass over existing Raft/Fault-Injection tests to update any assertion
that checked `LogEntryCommittedPayload`'s exact shape. The new
`deriveKvStoreForNode` hook gets its own dedicated test file (parsing,
per-node lag, partition-frozen view). Content tests and the standard
lint/build/route-smoke-test cycle follow the established shape. Manual
browser verification remains unavailable in this environment, as always.

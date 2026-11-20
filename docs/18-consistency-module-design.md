# 18 — Consistency Module Design

## Where this sits

Per [08-module-roadmap.md](./08-module-roadmap.md), Module 3 — Consistency
— asks: given replication + real latency (Modules 1-2, already built),
what can a *client* actually observe? The learner has already seen a
leader accept a write and copy it to followers, under both async and
sync modes. What's missing is the client's side of that story: if you
read from a follower mid-replication, what do you get back?

## No new engine module

Same precedent as Fault Injection (Module 8, reusing Raft's engine
verbatim): Consistency does not get its own `src/modules/consistency/`
folder. It **extends the Replication module's own engine** —
`replicationReducer.ts`, `replicationEvents.ts`, `replicationBehaviors.ts`
— with one new capability, `READ`, because reading is a natural
companion action to `WRITE` on the exact same state (`store`,
`pendingSyncWrites`) the Replication module already tracks. Building a
second, parallel store/message model that just re-derives what
Replication already has would be duplication with no teaching value —
the interesting content here is entirely about what a *read* observes,
not a new state shape.

The `consistency` registry entry is a content-only identity over
`createReplicationModule`, exactly like `fault-injection` is over
`createRaftModule`: same topology (leader + 3 followers, star, ids
`leader`/`f1`/`f2`/`f3`), same node/link config, its own guided steps /
quiz / challenges, and its own `ConsistencyControls` for driving reads.

## The new mechanic: `READ`

```ts
{ type: "READ", nodeId: string, key: string, consistency: "eventual" | "strong" }
```

- **Eventual read** (`consistency: "eventual"`): returns the target
  node's own local `store[key]` immediately, same tick. No message
  sent. This is what a client naively reading from "the nearest
  replica" gets — it may be stale if a write hasn't been delivered to
  that node yet, or (in sync mode) not yet acknowledged.
- **Strong read** (`consistency: "strong"`):
  - If the target node **is** the leader: identical to an eventual
    read — the leader's own store is always authoritative, no round
    trip needed.
  - If the target node is a **follower**: the follower cannot answer
    on its own authority. It sends a `read-forward` message to the
    leader (same `MESSAGE_SENT`/latency/loss/reorder machinery every
    other message kind already rides), the leader responds with
    `read-forward-response` carrying its current value for that key,
    and only *that* delivery produces `READ_SERVED`. This makes the
    cost of strong consistency visible and literal: it's a full
    round-trip animated on the canvas, not a rule stated in prose.

This directly motivates the CAP module that follows it (Module 4): a
strong read requires reaching the leader, so what happens when the
leader is unreachable becomes the natural next question, but that
question is explicitly **out of scope here** — this module doesn't add
partition-aware read failure/refusal behavior; a strong read against an
unreachable leader will just behave like any other dropped/delayed
message (the learner sees it hang, per Networking's own drop/latency
model), not something Consistency itself has an opinion about yet.

## New events

- `READ_REQUESTED { nodeId, key, consistency }` — emitted the instant
  `READ` is dispatched, before we know the answer. Lets the UI show
  "a read is in flight" for strong reads that will take multiple ticks,
  the same way `WRITE_ACCEPTED` doesn't imply `WRITE_ACKNOWLEDGED` yet
  in sync mode.
- `READ_SERVED { nodeId, key, value, consistency, servedByNodeId }` —
  the answer. For eventual reads, `servedByNodeId === nodeId` and the
  event fires the same tick as `READ_REQUESTED`. For strong reads on a
  follower, `servedByNodeId === leaderId` and the event fires on
  delivery of `read-forward-response`, however many ticks later that
  is. `value` is `undefined`/omitted if the key was never written
  anywhere yet (a legitimate "not found," not an error case).

Both ride the same `moduleId: "replication"` (not a new `"consistency"`
module id) since they're events the shared engine emits — exactly how
`WRITE_ACCEPTED` etc. already work. The `consistency` registry entry's
guided/quiz/challenge content simply reads these events like it reads
`WRITE_ACCEPTED`.

## New message kind

`ReplicationMessageKind` grows two entries: `"read-forward"` and
`"read-forward-response"`, alongside the existing `"replicate"` /
`"replicate-ack"`. Same transport, same fault-injection exposure (a
strong read's forward message can be dropped, delayed, or reordered
exactly like a replicate message can) — this is not a new pipe, it's
two new labels on the existing one.

## What demonstrates the actual teaching goal

The roadmap's stated goal — "read from different replicas mid-
replication and see divergent answers" — comes for free once `READ` and
the store already exist: the learner submits a write (async or sync,
their choice, from Module 2's controls, which stay mounted), then
immediately issues eventual reads against several different followers
before replication has caught up everywhere, and sees different values
(or a "not found") depending on which node answered and how far
delivery has progressed. No scripted scenario is required to produce
this — it's an emergent property of the existing latency model, which
is exactly the point: staleness isn't a special case, it's what
"replication + latency" already implies once you have a way to look.

Read-your-writes is demonstrated the same way, from the other
direction: a client that just wrote a value to the leader, then reads
that same key from a follower with an eventual read, may see the *old*
value — violating the intuitive expectation that "I just set this, so
reading it back should show my write." A strong read from the same
follower right after does not have this problem (by construction, since
it always resolves through the leader), which is the direct contrast
the guided content will draw.

## Non-goals

- No quorum reads (majority-of-N agreement) — that's Module 5,
  explicitly next after CAP. A "strong read" here means "ask the
  leader," not "ask a majority and reconcile."
- No causal/monotonic-reads guarantees, no vector clocks, no session
  tokens. Kept to the two consistency levels the roadmap names
  (strong, eventual) — anything richer belongs in a follow-on module if
  ever added, per the "explicitly out of scope for v1" section of the
  roadmap doc.
- No new fault-injection behavior beyond what already applies to any
  message (drop/delay/reorder/duplicate) — a strong read's forward
  message isn't special-cased against faults.
- No changes to `WRITE`'s existing behavior (async/sync semantics from
  Module 2 are untouched).

## UI additions

- `ConsistencyControls` (new, mounted only when `moduleId ===
  "consistency"`, same conditional pattern as `ReplicationControls`):
  node selector (which node to read from), key input, an
  eventual/strong toggle (mirroring `ReplicationControls`' sync/async
  toggle styling and `aria-pressed` usage), a Read button, and the
  existing Write button/inputs reused underneath (a client needs to be
  able to write before it can observe staleness on a read — Write stays
  available here, unlike Fault Injection's controls which added nothing
  of their own to Raft's).
- Inspector (`renderNodeDetail` for the `consistency` entry): same
  store-contents view Replication already has, plus the **last read
  served** by that node (key, value, consistency level, how many ticks
  the round trip took for strong reads) — derived from the event log
  via a new small hook, `useLastReadServed(events, nodeId, tick)`,
  following the existing derive-from-events-only convention.

## Content plan

- **Guided steps**: (1) eventual read of an unwritten key returns "not
  found"; (2) write then immediately eventual-read a different,
  not-yet-caught-up follower — observe staleness; (3) same scenario,
  but a strong read from that follower instead — observe the round
  trip and the correct value; (4) write, then read-your-writes: read
  the just-written key from a follower eventually vs strongly, side by
  side, and see them disagree while replication is still in flight.
- **Quiz**: at least one quiz whose question is answerable only by
  reasoning about *timing* (e.g., "will an eventual read issued the
  same tick as a sync write see the new value?") — following the
  established principle (Raft M24, Fault Injection M28, Replication
  M32) that every quiz branch must have a guaranteed, bounded terminal
  event. `READ_SERVED` is a clean terminal event for every read, so
  this should be easier to get right than Replication's sync-write quiz
  was.
- **Challenges**: e.g. "produce two different eventual read results for
  the same key without any read reporting an error," and "get a strong
  read to take at least N ticks by adjusting link latency first."

## Testing strategy (per milestone, detailed in the milestones doc)

Same standard as every prior module: unit tests on the reducer/behavior
extension (`READ` handling, both consistency levels, message kind
plumbing, fault interaction with `read-forward`), hook tests for
`useLastReadServed`, content tests for guided steps/quiz/challenges,
plus the standing lint/build/route-smoke-test cycle. Manual browser
verification remains unavailable in this environment and will be
flagged as such, as with every module so far.

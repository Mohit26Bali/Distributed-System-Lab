# 12 — Module Design: Raft

## Why this module, and why now

Per [08-module-roadmap.md](./08-module-roadmap.md), Raft (Module 7) is
the composite: leader election + log replication + quorum commit,
"taught as 'you already know all three pieces, here is how one real
algorithm assembles them.'" [10-election-module-design.md](./10-election-module-design.md)
already deviated from that roadmap's stated dependency order once
(building Leader Election before Replication/Consistency/CAP/Quorum);
this module deviates again in the same way, for the same reason: Raft
doesn't actually need Modules 2-5 built as separate lessons first, it
needs the *concepts* those modules would have taught (replication,
majority agreement), and Raft is a more effective way to teach them in
context than building throwaway standalone versions first would be.

Raft is explicitly positioned in that roadmap as the payoff module:
"the platform's animation vocabulary... pays off most visibly, since
every visual element was already introduced individually in an earlier
module." Everything Raft needs — node roles, message transport with a
`kind` discriminator, timer-driven role changes, fault injection, an
inspector extension point — was built generically enough in Modules 1
and 6 (Networking, Leader Election) that this module is close to pure
composition, not new framework work. Where it does force a real
framework change, that's called out explicitly below.

## Learning objectives

After this module, a learner should be able to:

1. Explain why Raft has **terms**: a monotonically increasing number
   that lets any node tell a current leader/vote from a stale one —
   directly closing the gap [10-election-module-design.md](./10-election-module-design.md)
   left open on purpose ("Bully has no term/epoch number... a node has
   no way to distinguish a *current* COORDINATOR announcement from a
   stale one").
2. Trace a leader election: a candidate increments its term, votes for
   itself, requests votes from every other node, and becomes leader
   once it holds a **majority** (not "the highest priority," Bully's
   rule — Raft's rule is "whoever gets there first with the most
   votes," which is why split votes and randomized timeouts matter).
3. Explain why election timeouts are **randomized** per node: if every
   follower timed out at the same tick, every one of them would become
   a candidate simultaneously, split the vote every single term, and
   never converge.
4. Trace log replication: a write submitted to the leader is appended
   to its own log first, then replicated via `AppendEntries`; it's only
   **committed** once a majority of nodes have it — and a leader crash
   before that majority is reached means the entry is genuinely lost,
   not silently recovered.
5. Predict and verify the partition/CAP behavior directly: a minority
   partition can never commit a write (no majority available), while
   the majority partition keeps working — Raft picks consistency over
   availability for the minority, a direct, hands-on instance of the
   CAP tradeoff [08-module-roadmap.md](./08-module-roadmap.md) describes
   for the (still unbuilt) CAP module.
6. Observe log reconciliation after a partition heals: a follower that
   fell behind has its conflicting tail entries overwritten by the
   leader's log, never merged — "the leader's log always wins," and why
   that's safe.

## Deliberate scope decision: manual bootstrap, automatic afterward

Every fault and command in this platform so far has been explicit and
learner-triggered — Leader Election's design doc treated this as a hard
constraint ("Automatic failure detection... is explicitly out of scope
... elections are always learner-triggered commands"). Raft's identity,
though, is fundamentally *timeout-driven*: a real Raft follower notices
leader silence and reacts on its own, and that reactive behavior is
itself part of what this module needs to teach.

The resolution: the **very first** election in a freshly loaded cluster
is a manual command (`START_ELECTION`, same shape as Bully's), because
nothing has happened yet for the engine to react to — there is no
bootstrap mechanism in this engine that runs code before the first
dispatched action (`SimulationModule.initialState` is a plain value, not
a `ReduceResult`, so it cannot itself schedule a timer). Once that first
election produces a leader, everything after is **automatic and
timer-driven**, using the exact `schedule`/`onTimer` channel every
module already uses:

- The new leader schedules a recurring `HEARTBEAT_TIMER` for itself the
  moment it wins — each firing sends `AppendEntries` (a heartbeat, empty
  unless there's something to replicate) to every other alive node and
  reschedules the next heartbeat.
- Every node that receives a valid `AppendEntries` or grants a vote
  (re)schedules its own randomized `ELECTION_TIMEOUT` — this is a normal
  reactive `schedule` request from within an already-dispatched action,
  not a bootstrap problem.
- A follower whose `ELECTION_TIMEOUT` fires without a fresher heartbeat
  since promotes itself to candidate **automatically** and starts an
  election — no learner action required. This is the one genuinely new
  category of platform behavior: previously every role change traced
  back to a learner's click; here, a timeout can promote a node on its
  own. It remains fully inspectable (a real `ELECTION_STARTED` event
  with `reason: "election-timeout"`, same vocabulary shape as Bully's
  `reason` field), just not learner-*initiated*.

This is a meaningful step up from Bully specifically because Raft's
whole pedagogical point is timeout-driven failure detection — simulating
it faithfully is more valuable here than staying consistent with
Bully's fully-manual model would be.

## Simulation model

### Node identity: no priority this time

Bully's node ids were small integers because priority ordering was the
entire mechanism. Raft has no priority — any node can win, depending on
timing and term — so this module's nodes are lettered (`"A"`-`"E"`),
deliberately different from Bully's scheme so a learner never conflates
"highest number wins" with "no such rule exists here."

### Node state

```ts
type RaftRole = "follower" | "candidate" | "leader";

interface LogEntry {
  term: number;
  index: number; // position in the log, 0-based
  value: string; // opaque label (e.g. "write-1") — no real state machine needed to teach commit safety
}

interface RaftNodeState {
  id: string;
  status: "alive" | "crashed"; // reused verbatim
  role: RaftRole;
  currentTerm: number;
  votedFor: string | null; // only meaningful for the CURRENT term
  log: LogEntry[];
  commitIndex: number; // highest log index known committed
  // Leader-only volatile state (per docs/04's "module-specific state is
  // opaque to the engine" — these fields simply go unused on non-leaders):
  nextIndex: Record<string, number> | null;
  matchIndex: Record<string, number> | null;
}
```

### Messages: same transport, richer payload

Same pattern as Election: real `MESSAGE_SENT`/`MESSAGE_DELIVERED`/
`MESSAGE_DROPPED` events, same `NetworkModel` latency/drop-rate/
partition handling, message payload carries a `kind` plus whatever
fields that kind needs:

```ts
type RaftMessageKind = "request-vote" | "vote-response" | "append-entries" | "append-response";
```

- `request-vote`: `{ term, candidateId, lastLogIndex, lastLogTerm }`
- `vote-response`: `{ term, voterId, granted: boolean }`
- `append-entries`: `{ term, leaderId, prevLogIndex, prevLogTerm, entries: LogEntry[], leaderCommit }`
- `append-response`: `{ term, followerId, success: boolean, matchIndex: number }`

This is the same architectural bet Election already validated: the
network transport doesn't care what a message *means*, so a fourth
distinct message vocabulary rides it unmodified.

### Module-owned events (`src/modules/raft/raftEvents.ts`)

- `ELECTION_STARTED { nodeId, term, reason: "manual" | "election-timeout" }`
- `NODE_ROLE_CHANGED { nodeId, role }` (same shape/name as Election's —
  not re-exported from there, since Raft's role set and meaning are its
  own; duplicating this small event type is cheaper than sharing it
  across modules that shouldn't otherwise depend on each other)
- `TERM_CHANGED { nodeId, term }` — fired whenever a node adopts a
  higher term it observed from another node's message, independent of
  any role change (the mechanism that lets stale leaders/candidates
  recognize they're stale)
- `VOTE_GRANTED { candidateId, voterId, term }`
- `LEADER_ELECTED { nodeId, term }`
- `LOG_ENTRY_APPENDED { nodeId, index, term }` — fired for the leader's
  own log on `SUBMIT_ENTRY`, and again for each follower once it
  accepts the entry via `AppendEntries`
- `LOG_ENTRY_COMMITTED { index, term }` — fired once, by the leader,
  the moment a majority is confirmed to have that index; this is the
  single event guided steps/challenges key off for "was this write
  actually safe"

### Reducer actions

```ts
type RaftAction =
  | { type: "START_ELECTION"; nodeId: string } // manual bootstrap only, see above
  | { type: "SUBMIT_ENTRY"; nodeId: string; value: string } // rejected (no-op) if nodeId isn't currently leader
  | { type: "KILL_NODE"; nodeId: string } // reused verbatim
  | { type: "PARTITION_NETWORK"; groups: string[][] } // reused verbatim
  | { type: "HEAL_PARTITION" }; // reused verbatim
```

A `SUBMIT_ENTRY` aimed at a non-leader is a no-op with no event — the
same precedent as `SET_LINK_CONFIG` rejecting an invalid value, or
`KILL_NODE` on an already-crashed node: rejected input is not itself a
fact worth logging, unlike a fault, which always is. (A real Raft client
would get redirected to the actual leader; this platform has no client
abstraction, so "select the leader yourself and submit" is the
learner-facing equivalent.)

### Vote-granting rule (the actual safety-critical logic)

A node grants a vote for `candidateId` in `term` if, in order:

1. `term >= currentTerm` (a request from a stale term is rejected
   outright — this is what terms are *for*). If `term > currentTerm`,
   the voter adopts the new term first (`TERM_CHANGED`) and reverts to
   `follower` if it was a candidate or leader.
2. `votedFor` is null or already `candidateId` for this term (a node
   votes at most once per term — this is half of why split votes are
   possible, and why they're safe rather than catastrophic).
3. The candidate's log is **at least as up to date** as the voter's own:
   compare last-entry term first (higher wins), then length (longer
   wins on a tie) — this is Raft's election-safety restriction, the
   mechanism that guarantees a newly elected leader already holds every
   previously committed entry. This is the one piece of "real Raft"
   complexity this module treats as **in scope, not simplified** — it's
   the actual reason Raft is safe, not an incidental detail.

### Log replication and the commit rule

On `SUBMIT_ENTRY` (leader only): append `{term: currentTerm, index:
log.length, value}` to the leader's own log, emit `LOG_ENTRY_APPENDED`,
then send `append-entries` to every other alive node with everything
from that follower's `nextIndex` onward.

On `append-entries` received (any node): reject (`success: false`) if
`term < currentTerm`, or if the log doesn't contain an entry at
`prevLogIndex` with term `prevLogTerm` (log inconsistency — the standard
Raft consistency check). Otherwise, append the new entries (truncating
any conflicting existing tail first), set `commitIndex =
min(leaderCommit, index of last new entry)`, and reply `success: true`
with the resulting `matchIndex`.

On `append-response` received (leader only): a rejection decrements that
follower's `nextIndex` by one and the leader retries on the next
heartbeat (Raft's log-matching backoff — deliberately simple/linear
here rather than the optimized "conflict term" backoff real
implementations use, since teaching the *existence* of backtracking
matters more than its constant-factor efficiency). A success updates
`nextIndex`/`matchIndex` for that follower, then the leader recomputes
`commitIndex`: the highest index replicated to a majority (including
itself) **whose entry's term equals the leader's current term** — never
committing an older-term entry by count alone. This is Raft's other
core safety subtlety and is also **in scope, not simplified**: it's the
mechanism that prevents a committed entry from ever being silently
overwritten by a future leader with a different history.

### What's explicitly simplified (non-goals)

- **No log compaction/snapshotting.** Logs grow unboundedly for the
  session; irrelevant at teaching scale (per
  [04-simulation-engine.md](./04-simulation-engine.md)'s "roughly up to
  ~9-12 nodes... one classroom-length session" bar).
- **No cluster membership changes** (adding/removing nodes mid-session).
- **No node recovery.** Consistent with every prior module — a crashed
  node stays crashed for the rest of the session.
- **No "conflict term" optimized backtracking** on `AppendEntries`
  rejection — linear `nextIndex` decrement only, noted above.
- **No real state machine.** Log entries carry an opaque `value` label;
  there's nothing to "apply" beyond marking an index committed, since
  the lesson is about replication/commit safety, not building a KV
  store (that's Module 9's job, per
  [08-module-roadmap.md](./08-module-roadmap.md)).

## UI additions

### Node visuals

Reuses `NodeGlyph`'s existing role-visual machinery
([10-election-module-design.md](./10-election-module-design.md)/M16)
essentially unchanged: leader → crown + amber ring, candidate → dashed
pulsing ring, selection → the M19-fixed `outline`. The only new
requirement is a **term badge** (small numeral near the node, e.g. a
`text-[10px]` label showing `currentTerm`) — Raft without a visible term
number would hide the exact mechanism the module exists to teach.  This
needs a new `useNodeTerm`/`deriveNodeTerm` hook (scans `TERM_CHANGED`,
mirrors `useNodeRole` exactly) and a small, additive change to
`NodeGlyph` gated the same way role visuals were (inert for modules with
no `TERM_CHANGED` events).

### Inspector

Uses the `renderNodeDetail` hook Election's design added
([10-election-module-design.md](./10-election-module-design.md)/M17) —
Raft's implementation shows `role`, `currentTerm`, `votedFor`,
`commitIndex`, and (leader only) a compact `nextIndex`/`matchIndex`
table. No further framework change needed here — this is exactly the
extension point built for a second real caller, now serving a third.

A selected message's kind is already surfaced generically via the
`MessageDetail.kind` field M19 added — Raft's four message kinds show up
there for free, same as Election's three did.

### Guided lessons (planned; final copy written during content-pass milestone)

1. Manually start the first election on any node; observe it becomes
   leader by majority vote (with 5 nodes, 3 votes), then automatically
   starts sending heartbeats.
2. Submit an entry to the leader; watch it replicate and become
   committed once a majority of followers have it — check the
   inspector's `commitIndex` on each node.
3. Kill the leader; observe a follower automatically starts a new
   election once its timeout fires (no manual trigger this time) and a
   new leader emerges.
4. Partition the leader into a minority group; submit an entry to it;
   observe it can never commit (no majority) while the majority side
   elects its own new leader and keeps committing writes.
5. Heal the partition; observe the stale ex-leader's conflicting
   uncommitted tail gets overwritten once it receives the current
   leader's `AppendEntries` — its own uncommitted entry is genuinely
   gone, not merged.

### Challenges (planned)

- Get an entry committed, then verify it survives a leader crash (kill
  the leader right after commit; confirm the entry is still present and
  committed on the new leader).
- Cause a submitted entry to be lost (submit to a leader, then
  partition/kill it before a majority replicates — confirm the entry
  never reaches `LOG_ENTRY_COMMITTED`).
- Cause a split vote (contrive two nodes' randomized timeouts to fire
  close enough together that neither gets a majority in the same term,
  forcing a second election round) — checked via two consecutive
  `ELECTION_STARTED` events for the same rough window with no
  intervening `LEADER_ELECTED`.

### Predictive quiz (planned)

- "The leader just replicated an entry to 2 of 5 nodes total (itself +
  1 follower) when it crashes. Is that entry committed?" (No — needs a
  majority, 3 of 5.)
- "Node C is partitioned into a 2-node minority. You submit an entry to
  it. What happens?" (It's accepted into C's own log but can never
  commit — no majority reachable.)

## Framework changes this module requires

Unlike Election (which needed real generalizations —
`ModuleDefinition` becoming generic, the `renderNodeDetail` hook, `quiz`
→ `quizzes`), Raft is intended to need close to **none**. The one
genuine addition is `useNodeTerm`/a term badge on `NodeGlyph` (additive,
inert elsewhere). Timer-chained heartbeats/election-timeouts use the
existing `schedule` channel exactly as already designed — a recurring
timer is just a reducer that re-requests itself, not a new engine
capability. If implementation surfaces a real need beyond that, it'll
be called out in that milestone's own summary, the same way Election's
milestones surfaced the `ModuleDefinition` generalization and the
leader-reassertion fix along the way rather than predicting them here.

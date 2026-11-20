# 20 — CAP Module Design

## Where this sits

Per [08-module-roadmap.md](./08-module-roadmap.md), Module 4 — CAP —
frames the partition scenario explicitly: given a network partition,
does the system answer anyway (possibly stale) or refuse to answer?
The learner should come away having *chosen* both sides of that
tradeoff themselves, on the same cluster, not read it as an assertion.

## No new engine, no new controls

This is a stronger version of the precedent Fault Injection and
Consistency both established: CAP needs **zero new engine code and
zero new UI**. Every mechanic it needs already exists:

- **The partition fault** (`PARTITION_NETWORK`/`HEAL_PARTITION`) has
  existed since Module 1 (Networking) and is dispatched by
  `FaultInjectionMenu`, which is mounted globally for every module
  (`src/app/modules/[moduleId]/page.tsx`), not per-module UI. Its fixed
  split is `[nodeIds[0]], [...rest]` — for this module's `["leader",
  "f1", "f2", "f3"]` node order, that's *exactly* "isolate the leader
  from every follower," the single most CAP-relevant partition shape,
  with no control changes required to get it.
- **Eventual and strong reads** (`READ`, added in Module 3 —
  Consistency, Milestones 33-35) are already the Availability/
  Consistency choice, framed differently: an eventual read always
  answers from local state (available, possibly stale); a strong read
  only ever answers via the leader (never stale, but unreachable if the
  leader can't be reached).
- **Sync writes never acknowledging past a dead/cut-off follower** (from
  Module 2 — Replication) already demonstrates the write-side of the
  same tradeoff.

So the `cap` registry entry reuses `createReplicationModule` and
`ConsistencyControls` verbatim — same identity-over-existing-engine
pattern as `fault-injection` over `raft`, but here there is no engine
extension step at all, because Consistency already built the one piece
CAP needed (`READ`) for its own reasons.

## What actually demonstrates CAP

1. **Partition the leader away** from the three followers (the default
   Partition button split).
2. **Availability, chosen**: an eventual read from a cut-off follower
   still answers immediately — its own store, frozen at whatever it
   last replicated before the partition. Available, but possibly stale
   (or a message written after the partition began will never arrive,
   so it may answer "not found" for something that now genuinely
   exists cluster-wide).
3. **Consistency, chosen**: a strong read from that same follower
   forwards to the leader, that forward message is silently dropped
   with reason `"partitioned"` (the exact mechanism Networking's own
   Milestone 1-3 already established — a partition doesn't announce
   itself, you only see silence), and `READ_SERVED` never fires. The
   follower is reachable and alive; it simply refuses to fabricate an
   answer it cannot verify against the leader. Unavailable, but never
   wrong.
4. **The write side, reframed**: a write submitted to the leader during
   the partition is still accepted locally — the leader doesn't know or
   care that it's cut off — but in sync mode it can never acknowledge
   for the isolated followers (identical mechanic to Replication's own
   Milestone 30/32 stuck-write behavior). CAP's content treats this as
   the same tradeoff on the write path, not a new mechanic to build.

## Non-goals (explicitly, and why)

- **No split-brain writes.** This topology has exactly one node that
  can ever accept a write (the leader, fixed for the session — no
  election exists in this module's engine). A genuine CAP split-brain
  scenario (two partitions each electing/accepting as if they were
  authoritative) needs a topology where *both* sides of a partition can
  independently decide they're in charge — that requires Module 6
  (Leader Election) or Module 7 (Raft)'s engine, not this one. Stated
  here explicitly so it's clear this is a deliberate scope boundary,
  not an oversight.
- **No quorum-based partial availability.** "A majority-side partition
  stays fully available, a minority-side one doesn't" is Module 5
  (Quorum)'s entire subject, immediately next on the roadmap. This
  module's choice is binary (answer locally vs. ask the leader), not
  majority-aware.
- **No new "refused" event and no timeout.** A strong read against an
  unreachable leader hangs forever — this reuses Consistency's already-
  established "no escape hatch" precedent (same as Replication's sync
  writes) rather than inventing a new terminal event. The hang *is* the
  refusal; there is nothing further to build.
- **No automatic mode switching or failover logic.** The learner picks
  eventual vs. strong by hand for every read; the module does not
  simulate a client library that degrades automatically.

## Content plan

- **Guided steps**: partition the leader away; eventual-read a cut-off
  follower and get an immediate (possibly stale/not-found) answer;
  strong-read the same follower and watch it hang; heal the partition
  and confirm the previously-hung strong read still never resolves
  retroactively (nothing retries automatically — a real, slightly
  uncomfortable fact worth making the learner discover, not just read);
  issue a *new* strong read after healing and see it resolve normally.
- **Quiz**: reasoning about which choice trades away what, built with a
  guaranteed-terminal resolution per the established principle — an
  eventual read (which always resolves) is the natural bounded signal
  for a "does the strong read ever come back" question, same as
  Consistency M35's own quiz.
- **Challenges**: reproduce the Availability outcome (stale-but-answered)
  and the Consistency outcome (correct-but-unavailable) under the same
  partition, plus a "why can't this cluster split-brain" conceptual
  challenge checked against the actual event log (verify only one
  node's writes were ever accepted, even during partition).

## Testing strategy

Since no engine or component code changes, there is nothing to unit-test
beyond the content itself (guided steps/quiz/challenges logic) — no new
reducer/behavior tests are needed. Content tests follow the exact same
shape as every prior module's. Standard lint/build/route-smoke-test
cycle still applies. Manual browser verification remains unavailable in
this environment, flagged as always.

# 13 — Milestones: Raft

Continues the global milestone numbering from
[11-election-milestones.md](./11-election-milestones.md) (which ended at
19). Same standing process as every prior series: design/tradeoffs are
covered in [12-raft-module-design.md](./12-raft-module-design.md); each
milestone below is implemented, tested, and explicitly approved before
the next begins. No code is written until each is individually approved.

## Milestone map (overview)

| #   | Milestone                                              | Depends on |
| --- | ------------------------------------------------------- | ---------- |
| 20  | Raft engine core: terms + majority-vote election        | 15 (Election engine core, for the pattern) |
| 21  | Automatic election timeouts + heartbeats                | 20         |
| 22  | Log replication + commit safety                          | 21         |
| 23  | Fault interactions + inspector detail (term/log/commit)  | 22, 17 (renderNodeDetail hook) |
| 24  | Module content pass                                      | 23         |

Raft gets one more milestone than Election (5 vs. 4) because log
replication's safety rules (§ "Log replication and the commit rule" in
the design doc) are substantial enough to deserve their own milestone
separate from the vote-only election mechanics, rather than bundling
both into one oversized step the way Election's M15-16 split roughly
matched (Election never had a second, comparably complex mechanism to
separate out).

---

## Milestone 20 — Raft engine core: terms + majority-vote election

### Goal

A new `/modules/raft` route with a real `src/modules/raft` reducer/
behaviors pair implementing `START_ELECTION` (manual bootstrap, per the
design doc) through to a single node winning by majority vote — terms,
`votedFor`, the election-safety log comparison, and vote counting all
real, but **no automatic timeouts and no log replication yet** (both are
later milestones). This milestone's scope intentionally mirrors
Election's M15 shape: prove the core mechanism once, manually triggered,
before making anything automatic.

### Features implemented

- `src/modules/raft/raftEvents.ts`: `ELECTION_STARTED`,
  `NODE_ROLE_CHANGED`, `TERM_CHANGED`, `VOTE_GRANTED`, `LEADER_ELECTED`
  event types + factories.
- `src/modules/raft/raftState.ts`: `RaftNodeState` (id, status, role,
  currentTerm, votedFor, log, commitIndex, nextIndex, matchIndex — log
  always empty and commitIndex always 0 until Milestone 22).
- `src/modules/raft/raftReducer.ts`: `START_ELECTION` (increment term,
  vote for self, send `request-vote` to every other alive node);
  `KILL_NODE`/`PARTITION_NETWORK`/`HEAL_PARTITION` reused verbatim from
  the same pattern Election established.
- `src/modules/raft/raftBehaviors.ts`: `onTimer` handling
  `request-vote`/`vote-response` message delivery — a voter applies the
  full vote-granting rule (term check, `votedFor` check, log
  up-to-dateness check) and replies; a candidate counts granted votes
  and becomes leader once it holds a majority (no `ELECTION_TIMEOUT`
  reaction yet — a candidate that doesn't reach a majority in this
  milestone just... waits, since automatic retry is Milestone 21's job).
- `ModuleDefinition` gains a `raft` entry: 5 lettered nodes (`A`-`E`),
  complete graph (votes/heartbeats need all-to-all reachability, same
  reasoning as Election's topology).

### Files created

- `src/modules/raft/raftEvents.ts`, `raftState.ts`, `raftReducer.ts`,
  `raftBehaviors.ts`, `raftModule.ts`

### Files modified

- `src/store/moduleRegistry.tsx` — new `raft` entry

### Testing strategy

- Unit tests: a node with no other alive nodes becomes leader
  immediately with a majority of one; a 5-node election reaches a
  correct majority (3 votes) and exactly one leader; a voter with a
  higher `currentTerm` rejects an older-term `request-vote`; a voter
  that already voted this term rejects a second candidate; a candidate
  whose log is less up-to-date than a voter's is rejected (construct
  this by hand-seeding a voter's log in test setup, since real
  replication doesn't exist yet); determinism test.

### Demo checklist

- [ ] `/modules/raft` loads with 5 lettered nodes, fully connected
- [ ] Starting an election on any node produces exactly one leader once
      votes resolve
- [ ] A second, concurrently started election on a different node
      converges to a single winner (whichever collects a majority first)
      without crashing or double-committing

### Future considerations (do not implement yet)

- Automatic election timeouts/heartbeats — Milestone 21.
- Log replication/`SUBMIT_ENTRY` — Milestone 22.
- Term badge on `NodeGlyph` — can land now or in Milestone 21; decide
  during implementation based on how useful it is for manually verifying
  this milestone (a term is genuinely hard to reason about via the
  event log alone).

---

## Milestone 21 — Automatic election timeouts + heartbeats

### Goal

The system becomes self-sustaining after the manual bootstrap: the
winning leader schedules recurring heartbeats, every node schedules a
randomized election timeout on hearing from a leader or granting a
vote, and a follower whose timeout fires promotes itself and starts a
new election automatically — no further learner action required to keep
the cluster functioning or to recover from a leader disappearing.

### Features implemented

- `HEARTBEAT_TIMER` (leader-only, self-rescheduling): sends an empty
  `append-entries` to every other alive node, reschedules itself.
- `ELECTION_TIMEOUT` (randomized duration via `ctx.random`, rescheduled
  on every valid heartbeat/vote-grant): a follower whose timeout fires
  promotes itself to candidate and starts an election with
  `reason: "election-timeout"`.
- `append-entries` (empty, heartbeat-only for now) received by a
  follower/candidate: if `term >= currentTerm`, accept the leader,
  revert to follower if not already, reschedule this node's own
  election timeout.
- `useNodeTerm`/`deriveNodeTerm` hook + term badge on `NodeGlyph` (if
  not already added in Milestone 20).

### Files created

- `src/hooks/useNodeTerm.ts`, `useNodeTerm.test.ts`

### Files modified

- `src/modules/raft/raftReducer.ts`, `raftBehaviors.ts` — heartbeat and
  election-timeout scheduling/handling
- `src/components/simulation/NodeGlyph.tsx` — term badge

### Testing strategy

- Unit tests: a leader's heartbeat keeps arriving on schedule and
  followers' election timeouts never fire while heartbeats keep landing
  (advance many ticks, assert no spurious `ELECTION_STARTED`); killing
  the leader and advancing past the timeout window produces exactly one
  automatic `ELECTION_STARTED` with `reason: "election-timeout"` and
  eventually exactly one new leader; two followers with different
  random timeout draws don't both become candidates at the same
  instant in a way that breaks vote counting (a split vote, if it
  happens, must still converge on a retry, never deadlock).
- Manual: kill the leader, advance the timeline, confirm a new leader
  emerges with no further clicks.

### Demo checklist

- [ ] After the manual bootstrap election, heartbeats keep the cluster
      stable indefinitely with no further input
- [ ] Killing the leader results in automatic recovery: a new leader
      within one election-timeout window, no manual trigger
- [ ] Term badge visibly increments across elections

### Future considerations (do not implement yet)

- Log replication — Milestone 22.

---

## Milestone 22 — Log replication + commit safety

### Goal

`SUBMIT_ENTRY` is real: a leader appends and replicates entries, a
majority-with-current-term rule governs `commitIndex`, and followers
correctly reject/backtrack on log-inconsistent `AppendEntries` per the
design doc's replication section — the actual safety mechanism the
whole module exists to teach.

### Features implemented

- `SUBMIT_ENTRY` action (rejected as a no-op if the target isn't
  currently leader).
- `append-entries` extended to carry real entries + `prevLogIndex`/
  `prevLogTerm`/`leaderCommit`; follower-side consistency check,
  truncate-and-append, `commitIndex` update.
- `append-response` handling on the leader: `nextIndex`/`matchIndex`
  bookkeeping, backtrack-and-retry on rejection, majority-with-
  current-term `commitIndex` recomputation.
- `LOG_ENTRY_APPENDED`/`LOG_ENTRY_COMMITTED` events.

### Files modified

- `src/modules/raft/raftReducer.ts`, `raftBehaviors.ts`

### Testing strategy

- Unit tests (the bulk of this milestone's value, mirroring how
  Milestone 16's bubble-up tests were the core of Election's protocol
  work): an entry submitted to the leader is committed once a majority
  of followers have replicated it, not before; a follower with a
  conflicting tail has it truncated and replaced, never merged; a
  leader never commits an older-term entry purely by replication count
  (construct a scenario with an entry from a previous leader's term
  still uncommitted, confirm it only becomes committed once a
  current-term entry at a later index is committed, per the design
  doc's stated safety rule); a log-inconsistent `AppendEntries` is
  rejected and the leader's `nextIndex` backtracks correctly on retry.
- Manual: submit several entries, watch `commitIndex` advance on each
  node in the inspector as replication catches up.

### Demo checklist

- [ ] Submitting an entry to the leader replicates it and it becomes
      committed once a majority holds it
- [ ] Submitting to a non-leader is rejected with no event
- [ ] A deliberately desynced follower's log is corrected via
      backtracking, not merging

### Future considerations (do not implement yet)

- Split-brain/partition walkthrough — Milestone 23.
- Inspector fields for log/commitIndex/nextIndex/matchIndex — Milestone
  23 (they exist as state now, but the `renderNodeDetail` wiring is
  bundled with the fault-interaction milestone the same way Election's
  M17 combined both).

---

## Milestone 23 — Fault interactions + inspector detail

### Goal

Prove the CAP-flavored partition behavior end to end (a minority
partition can never commit) and give the inspector real visibility into
term/log/commitIndex/nextIndex/matchIndex, reusing the `renderNodeDetail`
hook Election's Milestone 17 added to the framework.

### Features implemented

- `raft`'s `renderNodeDetail`: role, currentTerm, votedFor,
  commitIndex, and (leader only) a compact nextIndex/matchIndex table.
- No new reducer logic expected — partition/kill are already reused
  verbatim; this milestone is about confirming the majority-quorum
  commit rule correctly makes minority-partition commits impossible,
  the same "prove it, don't just assume it" spirit as Election's M17.

### Files modified

- `src/store/moduleRegistry.tsx` — `raft`'s `renderNodeDetail`

### Testing strategy

- Unit tests: partition a 5-node cluster into a 2-node minority
  (containing the current leader) and a 3-node majority; submit an
  entry to the minority leader, advance many ticks, assert it never
  reaches `LOG_ENTRY_COMMITTED`; assert the majority side elects its
  own leader (via automatic timeout, from Milestone 21) and can commit
  its own entries independently; heal the partition and assert the
  stale minority leader's uncommitted entry is overwritten once it
  receives the majority leader's `AppendEntries`.
- Manual: partition, submit to both sides, inspect commitIndex on
  every node to confirm the story matches what the log shows.

### Demo checklist

- [ ] A minority partition genuinely cannot commit, ever, until healed
- [ ] The majority partition elects its own leader automatically and
      keeps committing
- [ ] Healing reconciles the stale side's log without manual replay
- [ ] Inspector shows term/log/commitIndex for any node, and
      nextIndex/matchIndex for the current leader

### Future considerations (do not implement yet)

- Explanation/guided/quiz/challenge content — Milestone 24.

---

## Milestone 24 — Module content pass

### Goal

Round out Raft to a complete learner experience, matching Election's
Milestone 18 shape: explanation copy, the 5 guided steps, 3 challenges,
and 2 quiz questions drafted in
[12-raft-module-design.md](./12-raft-module-design.md), landing-page
entry (automatic, same as Election's — the landing page already
iterates the registry).

### Files created

- `src/store/raftGuidedSteps.ts`, `raftQuiz.ts`, `raftChallenges.ts`
  (same location convention Election's content actually used, per
  Milestone 18's note that this is where the codebase settled rather
  than the originally-planned `src/app/modules/<id>/content/` split).

### Files modified

- `src/store/moduleRegistry.tsx` — wire guided/quizzes/challenges into
  the `raft` entry; updated description copy (the M20-23 entries will
  likely say "early build" placeholders worth revisiting here, same as
  Election's did until this milestone).

### Testing strategy

- Unit tests for each guided step/quiz/challenge (mirrors Milestone 18
  exactly).
- Manual: full learner walkthrough — explanation → all 5 guided steps →
  both quiz questions → all 3 challenges — confirm no dead ends, and
  that the "entry survives a leader crash" challenge and the "entry is
  lost" challenge are both genuinely reachable and distinguishable from
  each other in the resulting event log.

### Demo checklist

- [ ] Raft reachable from the landing page with distinct explanation
      content
- [ ] All 5 guided steps completable in order, each gated on a real
      event-log fact
- [ ] Both quiz questions reveal the true outcome after the scenario runs
- [ ] All 3 challenges completable via more than one valid approach

### Future considerations (do not implement yet)

- A dedicated polish/accessibility pass (mirroring Milestone 19) —
  decide once this milestone is done and something concrete has been
  built to audit, same as how Milestone 19 wasn't pre-planned until
  Election's content pass was actually finished.
- Module 8 (Fault Injection deep-dive) and Module 9 (Distributed
  Database capstone) — each their own future milestone series, scoped
  when reached.

# 15 — Milestones: Fault Injection Deep-Dive

Continues the global milestone numbering from
[13-raft-milestones.md](./13-raft-milestones.md) (which ended at 25,
Raft's own polish pass). Design/tradeoffs are covered in
[14-fault-injection-module-design.md](./14-fault-injection-module-design.md).
Same standing process: each milestone is implemented, tested, and
explicitly approved before the next begins.

## Milestone map (overview)

| #   | Milestone                                          | Depends on |
| --- | ---------------------------------------------------- | ---------- |
| 26  | Message-level faults added to Raft's action set       | 22 (log replication, for message-kind context) |
| 27  | `fault-injection` registry entry + route              | 26         |
| 28  | Content pass: composed-fault guided steps/quiz/challenges | 27     |

Three milestones, the smallest of any module series so far, matching
the roadmap's own characterization of this as mostly content work.

---

## Milestone 26 — Message-level faults added to Raft's action set

### Goal

`DROP_MESSAGE`, `REORDER_MESSAGE`, `DUPLICATE_MESSAGE` become real,
working actions for the Raft module — today `FaultInjectionMenu`
dispatches them unconditionally for every module, but Raft's reducer
has never had cases for them (a Milestone 23 defensive `default` case
prevents a crash, but they've always silently no-op'd). This milestone
fixes that for Raft specifically, implemented identically to
Networking's versions.

### Features implemented

- `raftReducer.ts`: `DROP_MESSAGE` (marks a specific in-flight message
  dropped, same as networking's), `REORDER_MESSAGE` (delays a specific
  in-flight message's delivery by N ticks, reschedules its
  `DELIVER_MESSAGE` timer), `DUPLICATE_MESSAGE` (creates a second
  in-flight message with the same kind/payload, new id, same delivery
  tick as the original).
- All three reuse the shared `messageDroppedEvent`/
  `messageReorderedEvent`/`messageDuplicatedEvent` factories from
  `src/simulation/events/networkEvents.ts` — no new event types.

### Files modified

- `src/modules/raft/raftReducer.ts`

### Testing strategy

- Unit tests mirroring `networking.test.ts`'s coverage for the same
  three actions, adapted to Raft's message shape (payload carries
  `kind` in addition to the fields networking's messages have):
  dropping an in-flight request-vote/vote-response/append-entries
  message prevents it from ever resolving to delivered; reordering
  delays delivery by exactly the requested ticks without changing the
  message's `kind`/content; duplicating produces exactly one extra
  delivery with a distinct message id, same kind.
- Regression test: a **reordered vote-response that arrives after the
  candidate's own election timeout has already fired and it restarted
  at a new term** is correctly ignored (the `response.term !==
  candidate.currentTerm` guard in `handleVoteResponse` already exists —
  this test proves it holds under a real reorder, not just a hand-built
  stale-term scenario like Milestone 20's).
- Regression test: a **duplicated AppendEntries** delivered to a
  follower a second time does not double-append or corrupt its log
  (idempotency already falls out of the existing prevLogIndex/
  prevLogTerm check — this test proves it rather than assuming it).

### Demo checklist

- [ ] Selecting an in-flight Raft protocol message and clicking Drop/
      Reorder/Duplicate in the fault menu now visibly works, instead of
      silently doing nothing
- [ ] A reordered vote-response that arrives late doesn't affect an
      election that already moved on
- [ ] A duplicated heartbeat doesn't corrupt a follower's log

### Future considerations (do not implement yet)

- Wiring these into a themed `fault-injection` route — Milestone 27.
- Adding the same three actions to Election — explicitly out of scope
  per the design doc; not needed by this module.

---

## Milestone 27 — `fault-injection` registry entry + route

### Goal

A new `/modules/fault-injection` route exists, reusing
`createRaftModule` verbatim — proving a "module" can be a pure content
identity over an existing engine, with no new simulation code.

### Features implemented

- New `MODULE_REGISTRY` entry: `fault-injection` — same node ids/
  topology as `raft`, `createModule: () => createRaftModule([...])`,
  distinct title/summary/description framing it as the adversarial-
  timing companion to the `raft` module.
- Landing page lists it automatically (already iterates the registry,
  no change needed).

### Files modified

- `src/store/moduleRegistry.tsx`

### Testing strategy

- `moduleRegistry.test.ts`'s existing "every module has distinct
  summary"/"links only reference declared node ids"/"every node has a
  canvas position" checks extend to this entry for free.
- Manual: navigate to the new route, confirm it loads independently of
  `/modules/raft` (switching between them gives a fresh engine each
  time, per the existing per-module engine-reset behavior).

### Demo checklist

- [ ] `/modules/fault-injection` loads with its own explanation text,
      distinct from `/modules/raft`
- [ ] Landing page lists both `raft` and `fault-injection` as separate
      entries

### Future considerations (do not implement yet)

- Guided steps/quiz/challenges — Milestone 28.

---

## Milestone 28 — Content pass: composed-fault guided steps/quiz/challenges

### Goal

Round out the module to a complete learner experience: the 5 guided
steps, 3 challenges, and 2 quiz questions drafted in
[14-fault-injection-module-design.md](./14-fault-injection-module-design.md),
each scripting a composed/adversarial-timing scenario rather than one
fault in isolation.

### Files created

- `src/store/faultInjectionGuidedSteps.ts`, `faultInjectionQuiz.ts`,
  `faultInjectionChallenges.ts` (same `src/store/` convention every
  prior content pass settled on).

### Files modified

- `src/store/moduleRegistry.tsx` — wire guided/quizzes/challenges into
  the `fault-injection` entry.

### Testing strategy

- Unit tests per guided step/quiz/challenge, mirroring every prior
  content-pass milestone's shape (windowed checks for guided steps,
  whole-log checks for challenges, bounded-resolution checks for
  quizzes — reusing the same lesson from Raft's Milestone 24 about
  quizzes needing a guaranteed terminal event on every branch).
- Manual: full learner walkthrough — explanation → all 5 guided steps →
  both quizzes → all 3 challenges — confirm each composed-fault scenario
  actually reaches the state its instruction describes.
- A final accessibility/polish check against the same baseline used for
  Election's Milestone 19 and Raft's Milestone 25 — expected to need
  little to no new work, since this module reuses every visual/control
  component unchanged; called out explicitly rather than skipped
  silently.

### Demo checklist

- [ ] Fault Injection module reachable from the landing page with
      distinct explanation content
- [ ] All 5 guided steps completable in order, each gated on a real
      event-log fact from a genuinely composed-fault scenario
- [ ] Both quiz questions resolve to a guaranteed outcome on every
      branch (no permanently-"waiting" quiz state)
- [ ] All 3 challenges completable via more than one valid approach

### Future considerations (do not implement yet)

- Module 9 (Distributed Database capstone) — its own future milestone
  series, scoped and approved when reached.

# 17 — Milestones: Replication

Continues the global milestone numbering from
[15-fault-injection-milestones.md](./15-fault-injection-milestones.md)
(which ended at 28). Design/tradeoffs are covered in
[16-replication-module-design.md](./16-replication-module-design.md).
Same standing process: each milestone is implemented, tested, and
explicitly approved before the next begins.

## Milestone map (overview)

| #   | Milestone                                       | Depends on |
| --- | -------------------------------------------------- | ---------- |
| 29  | Engine core: static roles + async write/replicate   | — (new module) |
| 30  | Sync mode + acknowledgment + mode toggle            | 29         |
| 31  | Registry entry + route + controls + inspector       | 30         |
| 32  | Content pass                                        | 31         |

Four milestones — smaller than Election/Raft, similar in size to Fault
Injection, matching this module's deliberately narrow scope (no
election, no quorum, no client reads).

---

## Milestone 29 — Engine core: static roles + async write/replicate

### Goal

A headless, tested `src/modules/replication` module: fixed leader/
follower roles, a `WRITE` action that replicates to every alive
follower over the real transport, async acknowledgment only (sync is
Milestone 30's job — this milestone proves the base replication
mechanism first, same "prove the simple case before the harder one"
shape every prior module series used).

### Features implemented

- `src/modules/replication/replicationEvents.ts`: `WRITE_ACCEPTED`,
  `WRITE_REPLICATED`, `WRITE_ACKNOWLEDGED` event types + factories;
  `ReplicationMessageKind` (`"replicate"` — `"replicate-ack"` lands in
  Milestone 30).
- `src/modules/replication/replicationState.ts`: `ReplicationNodeState`
  (id, status, role, store), `ReplicationState` (nodes, messages,
  nextMessageId, mode — hardcoded `"async"` for now, `mode` toggle
  itself is Milestone 30).
- `src/modules/replication/replicationReducer.ts`: `WRITE` (leader-only,
  rejected otherwise), `KILL_NODE` reused verbatim.
- `src/modules/replication/replicationBehaviors.ts`: `onTimer` handling
  `replicate` message delivery — a follower applies the write to its
  own `store` and emits `WRITE_REPLICATED`.
- `ModuleDefinition` gains a `replication` entry: star topology
  (`leader`, `f1`, `f2`, `f3`), no guided content yet.

### Files created

- `src/modules/replication/replicationEvents.ts`, `replicationState.ts`,
  `replicationReducer.ts`, `replicationBehaviors.ts`, `replicationModule.ts`

### Files modified

- `src/store/moduleRegistry.tsx` — new `replication` entry

### Testing strategy

- Unit tests: `WRITE` on the leader emits `WRITE_ACCEPTED` +
  `WRITE_ACKNOWLEDGED` in the same tick, and sends `replicate` to every
  alive follower; `WRITE` on a follower (or a crashed leader) is a
  no-op; each follower's own `store` updates only once its `replicate`
  message actually delivers (respecting real latency — not before);
  killing a follower before a write means that follower's `store` never
  gets the key, while the others still do; determinism test.

### Demo checklist

- [ ] `/modules/replication` loads with a star topology (leader in the
      middle, three followers)
- [ ] A write on the leader visibly replicates to all three followers
      over real latency
- [ ] A write on a follower is rejected (no-op)

### Future considerations (do not implement yet)

- Sync mode, the mode toggle, `replicate-ack` — Milestone 30.
- Controls/inspector — Milestone 31.

---

## Milestone 30 — Sync mode + acknowledgment + mode toggle

### Goal

`SET_REPLICATION_MODE` becomes real; sync writes wait for every
currently-alive follower's `replicate-ack` before `WRITE_ACKNOWLEDGED`
fires — including the harsh, undocumented-as-a-bug case where a dead
follower means the write never acknowledges at all.

### Features implemented

- `SET_REPLICATION_MODE` action; `state.mode` toggle.
- `replicate-ack` message kind, sent by a follower on `replicate`
  delivery only when the current mode is sync.
- `pendingSyncWrites` bookkeeping on the leader; `WRITE_ACKNOWLEDGED`
  fires only once a write's `awaiting` list is empty.

### Files modified

- `src/modules/replication/replicationReducer.ts`, `replicationBehaviors.ts`

### Testing strategy

- Unit tests: a sync write with all followers alive eventually
  acknowledges once every ack arrives, not before; a sync write
  submitted while a follower is already dead acknowledges once the
  *remaining* alive followers ack (the dead one is correctly excluded
  from `awaiting`); a sync write whose follower dies **after** the
  write was sent but **before** it acks never acknowledges, even after
  many ticks (the core "no escape hatch" behavior — asserted directly,
  not just assumed); switching modes mid-session only affects writes
  submitted after the switch, not ones already pending.
- Regression-style test: the exact same write + same fault, run once in
  async and once in sync (two separate engine instances), produces
  different acknowledgment outcomes — directly exercising the
  roadmap's "same write, same fault, compare both" framing as an
  automated check, not just a guided-lesson narrative.

### Demo checklist

- [ ] Toggling to sync mode and submitting a write only acknowledges
      once every follower has confirmed
- [ ] Killing a follower before it acks a sync write leaves that write
      permanently pending
- [ ] The identical write/fault pair resolves differently under async
      vs. sync

### Future considerations (do not implement yet)

- Controls/inspector wiring — Milestone 31.

---

## Milestone 31 — Registry entry + route + controls + inspector

### Goal

A real, usable `/modules/replication` route: a `ReplicationControls`
component (mode toggle, key/value inputs, Write button), inspector
detail (role, store contents, pending sync acks), and removal of the
stray leftover `SEND_PING` debug panel in `SimulationCanvas.tsx` found
during this module's design research.

### Features implemented

- `src/components/controls/ReplicationControls.tsx`.
- `renderNodeDetail` for the `replication` entry: role, `store` as
  key→value pairs, and (leader only) any `pendingSyncWrites`.
- Remove the hardcoded `SEND_PING` `Panel` from `SimulationCanvas.tsx`
  — dead weight since `ElectionControls`/`RaftControls`/
  `ReplicationControls` are the real, current pattern for per-module
  temporary triggers.

### Files created

- `src/components/controls/ReplicationControls.tsx`

### Files modified

- `src/components/simulation/SimulationCanvas.tsx` — remove the stray
  panel
- `src/components/learning/ExplanationPane.tsx` — mount
  `ReplicationControls` for `moduleId === "replication"`
- `src/store/moduleRegistry.tsx` — `renderNodeDetail`

### Testing strategy

- `moduleRegistry.test.ts`'s existing generic checks extend to the new
  entry for free.
- Manual: navigate to `/modules/replication`, confirm the stray ping
  button is gone from every module's canvas (not just this one), submit
  a write in each mode, confirm the inspector shows each node's store
  and (for the leader) pending acks.

### Demo checklist

- [ ] `/modules/replication` has working Write/mode-toggle controls
- [ ] Inspector shows per-node store contents and leader pending-acks
- [ ] The stray `SEND_PING` panel no longer appears on any module

### Future considerations (do not implement yet)

- Guided steps/quiz/challenges — Milestone 32.

---

## Milestone 32 — Content pass

### Goal

Round out Replication to a complete learner experience: the 5 guided
steps, 3 challenges, and 2 quiz questions drafted in
[16-replication-module-design.md](./16-replication-module-design.md).

### Files created

- `src/store/replicationGuidedSteps.ts`, `replicationQuiz.ts`,
  `replicationChallenges.ts`.

### Files modified

- `src/store/moduleRegistry.tsx` — wire guided/quizzes/challenges into
  the `replication` entry.

### Testing strategy

- Unit tests per guided step/quiz/challenge, same shape as every prior
  content-pass milestone.
- Manual: full learner walkthrough, confirming the side-by-side
  async-vs-sync comparison step actually demonstrates a visible
  difference.
- A final accessibility/polish check against the Milestone 19/25
  baseline — expected to need little new work (no new visual role
  machinery per this module's design), called out explicitly rather
  than skipped silently.

### Demo checklist

- [ ] Replication reachable from the landing page with distinct
      explanation content
- [ ] All 5 guided steps completable in order
- [ ] Both quiz questions resolve to a guaranteed outcome
- [ ] All 3 challenges completable

### Future considerations (do not implement yet)

- Module 3 (Consistency) — reuses this module's per-node `store` field
  directly; its own future milestone series, scoped when reached.

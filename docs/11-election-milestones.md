# 11 — Milestones: Leader Election (Bully)

Continues the global milestone numbering from
[09-implementation-roadmap.md](./09-implementation-roadmap.md) (which
ended at 14). Follows the same standing process: each milestone is
explained (design/tradeoffs already covered in
[10-election-module-design.md](./10-election-module-design.md)), then
implemented, tested, and explicitly approved before the next begins. No
code is written for any of these until each is individually approved.

## Milestone map (overview)

| #   | Milestone                                            | Depends on |
| --- | ----------------------------------------------------- | ---------- |
| 15  | Election engine core + minimal routing                | 9, 12 (existing) |
| 16  | Full Bully protocol: bubble-up, timeouts, role visuals | 15         |
| 17  | Fault interactions + inspector detail                  | 16, 9 (existing) |
| 18  | Module content pass (explanation/guided/quiz/challenges)| 17         |

---

## Milestone 15 — Election engine core + minimal routing

### Goal

A new `/modules/election` route exists, backed by a real (if minimal)
`src/modules/election` reducer/behaviors pair. `ModuleDefinition` is
generalized to be generic over `<State, Action>` (the mechanical fix
described in [10-election-module-design.md](./10-election-module-design.md)),
proven by the registry now holding two differently-shaped modules
without either page/component code branching on which one is active. A
single hardcoded "Start Election" command on one specific node produces
a visible `ELECTION`/`OK`/`COORDINATOR` message sequence on the canvas,
reusing `PacketDot` unchanged — no bubble-up, no timeouts, no role
visuals yet (the single-hop case: starting the election on the
already-highest node).

### Features implemented

- `src/modules/election/electionEvents.ts`: `ELECTION_STARTED`,
  `NODE_ROLE_CHANGED`, `LEADER_ELECTED` event types + factories.
- `src/modules/election/electionState.ts`: node priority + role map,
  reusing `Message`/`NodeState` domain types.
- `src/modules/election/electionReducer.ts`: `START_ELECTION` only for
  now (the trivial "I'm already highest" path); `KILL_NODE` reused
  verbatim from the networking reducer's logic (import/share the
  handler rather than duplicate it, since the behavior is identical).
- `src/modules/election/electionBehaviors.ts`: `onTimer` handling
  message delivery for `ELECTION`/`OK`/`COORDINATOR` kinds (transport
  only — no bubble-up reaction logic yet, that's Milestone 16).
- `ModuleDefinition<State, Action>` generalized in `moduleRegistry.ts`;
  `MODULE_REGISTRY` gains an `election` entry (complete-graph topology,
  5 nodes, priorities `"1"`-`"5"`).
- A temporary "Start Election (node 5)" button, mirroring how Milestone
  5 used a temporary "Send Ping" button before guided content existed.

### Files created

- `src/modules/election/electionEvents.ts`, `electionState.ts`,
  `electionReducer.ts`, `electionBehaviors.ts`, `electionModule.ts`
  (factory, mirrors `networkingModule.ts`)

### Files modified

- `src/store/moduleRegistry.ts` — generic `ModuleDefinition<State,
  Action>`; new `election` entry
- `src/app/modules/[moduleId]/page.tsx` — no change expected if it
  already only calls through the generic `SimulationModule` interface;
  confirm this during implementation rather than assuming it

### Testing strategy

- Unit tests: `START_ELECTION` on the highest-priority alive node
  immediately produces `ELECTION_STARTED` → `LEADER_ELECTED` with no
  `ELECTION`/`OK` messages sent (nobody outranks it); on a non-highest
  node, produces `ELECTION` messages addressed only to higher-priority
  alive nodes, never to lower ones or crashed ones.
- Type-check confirms `MODULE_REGISTRY` holds both `networking` and
  `election` entries without either module's concrete types leaking
  into shared component code.
- Manual: navigate to `/modules/election`, click "Start Election," watch
  the message travel on the canvas exactly like a Module 1 ping.

### Demo checklist

- [ ] `/modules/election` loads with 5 nodes, fully connected
- [ ] Clicking "Start Election" on the highest node instantly shows it
      becoming leader with no message traffic
- [ ] `pnpm build`/lint pass with the generalized `ModuleDefinition`
      type

### Future considerations (do not implement yet)

- Bubble-up reaction to `ELECTION` messages, `OK`/`COORDINATOR` handling,
  timeouts — Milestone 16.
- Role visuals on `NodeGlyph` — Milestone 16 (no role ever changes to
  anything but `leader` yet, so there's nothing to visually distinguish
  until bubble-up exists).

---

## Milestone 16 — Full Bully protocol: bubble-up, timeouts, role visuals

### Goal

The complete election algorithm from
[10-election-module-design.md](./10-election-module-design.md): starting
an election on any node correctly bubbles up to the true highest-priority
alive node via `OK`/`ELECTION` relaying, `ELECTION_TIMEOUT`/
`COORDINATOR_TIMEOUT` handle the no-response cases, and `NodeGlyph` shows
a real leader/candidate/follower visual driven by `NODE_ROLE_CHANGED`.

### Features implemented

- `electionReducer.ts`/`electionBehaviors.ts` extended with the full
  algorithm: `ELECTION` message received → reply `OK` + start own
  election if not already a candidate; `OK` received → cancel election
  timeout, schedule coordinator timeout; `COORDINATOR` received → adopt
  follower role; both timeouts scheduled via the existing `schedule`
  channel and handled in `onTimer`.
- `src/hooks/useNodeRole.ts`: `deriveNodeRole`/`useNodeRole`, scanning
  `NODE_ROLE_CHANGED` events (mirrors `useNodeStatus.ts` exactly).
- `NodeGlyph` gains the additive role visual (amber ring + crown for
  leader, dashed pulsing sky ring for candidate, reduced-motion-aware).

### Files created

- `src/hooks/useNodeRole.ts`, `useNodeRole.test.ts`

### Files modified

- `src/modules/election/electionReducer.ts`, `electionBehaviors.ts`
- `src/components/simulation/NodeGlyph.tsx`

### Testing strategy

- Unit tests (this is the bulk of the milestone's value): election
  started on the lowest-priority node bubbles all the way to the
  highest-priority alive node across a 5-node scenario; a node that
  never receives an `OK` within its timeout self-declares; a candidate
  that gets an `OK` but no `COORDINATOR` within the second timeout
  restarts its own election; concurrent elections started on two
  different nodes still converge on exactly one leader.
- Determinism test extended: same seed + same command sequence twice ⇒
  identical event log, including timeout-driven events.
- Manual: start an election on node 1 in the 5-node topology, confirm
  node 5 ends up `leader` and every other node ends up `follower`, watch
  the candidate pulse and leader crown appear at the correct ticks via
  the timeline.

### Demo checklist

- [ ] Starting an election on any node always results in exactly one
      leader: the highest-priority alive node
- [ ] Candidate and leader visuals appear only on nodes that actually
      changed role (verified against the event log, not assumed)
- [ ] Killing the current leader and starting a new election elects the
      next-highest alive node
- [ ] All new reducer/behavior unit tests pass; determinism test passes

### Future considerations (do not implement yet)

- Partition-driven split-brain scenario walkthrough and inspector role
  detail — Milestone 17.

---

## Milestone 17 — Fault interactions + inspector detail

### Goal

Prove the "faults are free" claim for this module: partitioning nodes
before an election correctly produces independent, potentially
conflicting leaders per partition group, with no election-specific
partition code required beyond what Module 1 already built. Add the
minimal `renderNodeDetail` inspector extension point.

### Features implemented

- `ModuleDefinition.renderNodeDetail?` optional field; `NodeInspector`
  renders it below the generic fields when present.
- Election module's `renderNodeDetail` shows `priority` and current
  `role`.
- No new reducer logic expected — `PARTITION_NETWORK`/`HEAL_PARTITION`
  are reused verbatim from networking; this milestone is about
  confirming (via tests and manual walkthrough) that the existing
  `isPartitioned` check inside message delivery already produces the
  correct split-brain behavior with zero election-specific changes.

### Files created

- None expected — confirm during implementation.

### Files modified

- `src/store/moduleRegistry.ts` — `renderNodeDetail` field
- `src/components/inspector/NodeInspector.tsx` — calls it if present
- `src/modules/election/electionModule.ts` (or a sibling file) —
  election's `renderNodeDetail` implementation

### Testing strategy

- Unit test: partition the 5-node topology into two groups, start an
  election independently in each group, assert each group produces its
  own leader (the highest-priority alive node *within that group*), and
  the two leaders differ when the true highest-priority node is in the
  minority group.
- Unit test: healing the partition produces no automatic role change
  (no event fires) until a new election is manually started — the
  "doesn't self-heal" property is explicitly asserted, not just assumed.
- Manual: partition node 5 away from nodes 1-4, start an election among
  1-4, confirm node 4 becomes leader there while node 5 (unreachable)
  never changes role; heal the partition; confirm both node 4 and node
  5 still show `leader` until a fresh election is triggered; click each
  node, confirm the inspector's new detail section shows correct
  priority/role.

### Demo checklist

- [ ] Partitioned groups elect independent leaders with no
      election-specific partition code added
- [ ] Two simultaneous leaders are visibly and honestly represented
      (not hidden or auto-corrected)
- [ ] Healing does not silently resolve the conflict
- [ ] Inspector shows priority/role for a selected node

### Future considerations (do not implement yet)

- Explanation/guided/quiz/challenge content — Milestone 18.

---

## Milestone 18 — Module content pass

### Goal

Round out the election module to a complete learner experience, matching
Milestone 13's shape for Networking: explanation copy, the 5 guided
steps and 3 challenges and 2 quiz questions drafted in
[10-election-module-design.md](./10-election-module-design.md), and a
landing-page entry.

### Features implemented

- `src/app/modules/election/content/explanation.md` (or equivalent),
  `guided.ts`, `quiz.ts`, `challenges.ts` for the election module.
- `src/app/page.tsx` — module picker lists `election` alongside
  `networking`/`introduction`.
- Final pass against the same accessibility/reduced-motion/colorblind
  checklist Milestone 14 established, applied to the new role visuals
  specifically (crown/ring must not be the only signal — confirm the
  shape difference alone is legible with color removed).

### Files created

- `src/app/modules/election/content/explanation.md`, `guided.ts`,
  `quiz.ts`, `challenges.ts`

### Files modified

- `src/store/moduleRegistry.ts` — wire guided/quiz/challenges into the
  `election` entry
- `src/app/page.tsx`

### Testing strategy

- Unit tests: each guided step's satisfaction check against a mock
  event log (mirrors Milestone 11's testing shape); each challenge
  checker accepts any valid path to the outcome, not just the exact
  scripted sequence (mirrors Milestone 12).
- Manual: full learner walkthrough — explanation → all 5 guided steps in
  order → both quiz questions → all 3 challenges — confirm no dead ends
  and that the split-brain challenge specifically is completable via
  more than one node/timing combination.
- Manual: OS-level reduced-motion on, confirm candidate pulse and role
  transitions degrade to instant per the existing M14 pattern.

### Demo checklist

- [ ] Election module reachable from the landing page with distinct
      explanation content
- [ ] All 5 guided steps completable in order, each gated on a real
      event-log fact
- [ ] Both quiz questions reveal the true outcome after the scenario runs
- [ ] All 3 challenges completable via more than one valid approach
- [ ] Reduced-motion and colorblind-safety checks pass for the new role
      visuals specifically

### Future considerations (do not implement yet)

- Raft (composes this module's election logic with replication +
  quorum) — its own future milestone series, scoped and approved when
  reached.
- Automatic heartbeat-driven election triggering — noted as explicitly
  out of scope in the design doc; revisit only if a concrete lesson
  needs it.

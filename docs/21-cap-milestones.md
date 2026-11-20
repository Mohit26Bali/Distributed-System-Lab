# 21 — CAP Milestones

Continues the project's global milestone numbering (last used: 35, in
[19-consistency-milestones.md](./19-consistency-milestones.md)).

Only two milestones — smaller than any prior module's series — because
per [20-cap-module-design.md](./20-cap-module-design.md), this module
requires **zero new engine or component code**: every mechanic it
teaches with (partition fault, eventual/strong reads, sync-write
stalling) already exists from Networking, Consistency, and Replication.

## Milestone 36 — Registry entry

- `moduleRegistry.tsx`: add `cap` entry — same topology/engine as
  `replication`/`consistency` (`createReplicationModule("leader",
  ["f1","f2","f3"])`), same `renderNodeDetail` as `consistency` (role,
  store, last read served — nothing CAP-specific to add there either).
- `ExplanationPane.tsx`: mount `ConsistencyControls` for `moduleId ===
  "cap"` (identical component, no new one needed).
- Manually verify (via the reducer/behavior tests already in place from
  Milestones 33/29) that `FaultInjectionMenu`'s default partition split
  for this node order does isolate the leader as expected — no new test
  needed since this is exercising already-tested reducer behavior
  through an already-tested UI default, not new logic.
- Route smoke-test `/modules/cap`.

## Milestone 37 — Guided steps, quiz, challenges, polish pass

- `capGuidedSteps.ts`: the five steps from the design doc (partition
  the leader, eventual read while cut off, strong read while cut off
  and observe the hang, heal without the hung read resolving, a fresh
  strong read after healing resolving normally).
- `capQuiz.ts`: at least one tradeoff-reasoning quiz with a guaranteed
  terminal resolution from the start.
- `capChallenges.ts`: the three challenges from the design doc
  (reproduce Availability, reproduce Consistency, verify no split-brain
  writes ever occurred).
- Full test/lint/build cycle + route smoke test.
- Accessibility/polish check as a verification pass (no new controls
  exist to introduce a gap — `ConsistencyControls` was already checked
  in Milestone 35), same "treat as a hypothesis to check" discipline as
  every prior module's polish pass.

Two milestones total (36-37) — the smallest module series so far,
directly reflecting how little genuinely new content this module adds
on top of what Consistency and Replication already built.

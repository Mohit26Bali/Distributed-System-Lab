# 19 — Consistency Milestones

Continues the project's global milestone numbering (last used: 32, in
[17-replication-milestones.md](./17-replication-milestones.md)).

## Milestone 33 — Engine: the `READ` action

Extend the Replication module's own engine (not a new module folder,
per [18-consistency-module-design.md](./18-consistency-module-design.md)):

- `replicationEvents.ts`: add `READ_REQUESTED`/`READ_SERVED` event
  types + payloads + factories; extend `ReplicationMessageKind` with
  `"read-forward"` / `"read-forward-response"`.
- `replicationReducer.ts`: add `READ` to `ReplicationAction`. Eventual
  reads resolve same-tick from local `store`. Strong reads on the
  leader resolve same-tick too. Strong reads on a follower send a
  `read-forward` message to the leader (reusing
  `sendReplicationMessage`/the existing message-timer scheduling
  pattern) and emit `READ_REQUESTED` immediately, with `READ_SERVED`
  deferred to delivery.
- `replicationBehaviors.ts`: on `read-forward` delivered at the leader,
  reply with `read-forward-response` carrying the leader's current
  value for that key. On `read-forward-response` delivered at the
  original requester, emit `READ_SERVED`.
- Tests: eventual read of unwritten key (not found), eventual read of a
  written key, strong read on leader vs. follower (round trip ticks
  match link latency), strong read interacting with `DROP_MESSAGE`/
  `REORDER_MESSAGE`/`DUPLICATE_MESSAGE` on the forward message, strong
  read against a crashed leader (never resolves — same "no timeout"
  precedent as sync writes, verified over a bounded tick budget same as
  Replication M30's stuck-write test), determinism.

## Milestone 34 — Registry entry, controls, inspector

- `moduleRegistry.tsx`: add `consistency` entry — same topology as
  `replication` (leader + f1/f2/f3, star), `createModule: () =>
  createReplicationModule("leader", ["f1","f2","f3"])`,
  `renderNodeDetail` extended with last-read-served info.
- `useLastReadServed(events, nodeId, tick)` hook + tests — derives from
  `READ_REQUESTED`/`READ_SERVED` events only, per the project's
  events-only derivation convention.
- `ConsistencyControls` component: node selector, key input,
  eventual/strong toggle (`aria-pressed`, labeled inputs from the
  start this time, not as a later polish-pass fix), Read button, plus
  the existing Write button/inputs.
- Wire `ConsistencyControls` into `ExplanationPane.tsx` for
  `moduleId === "consistency"`.
- Route smoke-test `/modules/consistency`.

## Milestone 35 — Guided steps, quiz, challenges, polish pass

- `consistencyGuidedSteps.ts`: the four steps from the design doc
  (not-found read, staleness via eventual read, round trip via strong
  read, side-by-side read-your-writes violation).
- `consistencyQuiz.ts`: at least one timing-reasoning quiz, built with
  a guaranteed-terminal resolution from the start (using `READ_SERVED`
  as the natural terminal signal, learning from Replication M32's
  quiz-redesign).
- `consistencyChallenges.ts`: the two challenges from the design doc
  (divergent reads, slow strong read).
- Full test/lint/build cycle + route smoke test.
- Accessibility/polish check performed proactively as part of this
  milestone (labels/`aria-pressed` built correctly in M34, so this
  pass should mainly be verification, not fixing — but treat that as
  a hypothesis to check, not an assumption, same as every prior
  module's polish pass).

Three milestones total (33-35), matching Fault Injection's pace rather
than Replication's four — the design doc's scope is deliberately
narrow (one new action, two consistency levels, no new module folder).

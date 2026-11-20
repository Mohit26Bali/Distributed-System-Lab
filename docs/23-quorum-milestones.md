# 23 — Quorum Milestones

Continues the project's global milestone numbering (last used: 37, in
[21-cap-milestones.md](./21-cap-milestones.md)).

## Milestone 38 — Engine: quorum writes

- `replicationEvents.ts`: extend `ReplicationMode` to `"sync" | "async"
  | "quorum"`.
- `replicationState.ts`: add `pendingQuorumWrites` alongside the
  existing `pendingSyncWrites` — purely additive, does not touch sync's
  own shipped structure.
- `replicationReducer.ts`/`replicationBehaviors.ts`: a quorum write
  sends `replicate` to every alive follower (identical to sync); once
  `ackedBy.length + 1` (leader counts itself) reaches the majority of
  the *total* cluster size (not just alive nodes — same precedent as
  Raft's own majority-from-total-cluster rule), emits the existing
  `WRITE_ACKNOWLEDGED` event. Never resolves if too many nodes are dead
  to reach majority.
- Tests: quorum write acknowledges with one follower dead (majority
  still reachable, 3 of 4), quorum write never acknowledges with two
  followers dead (majority broken, 2 of 4), exact boundary case,
  interaction with `DROP_MESSAGE`/`KILL_NODE` on quorum's acks,
  determinism.

## Milestone 39 — Engine: quorum reads

- `replicationState.ts`: add `storeVersions: Record<nodeId,
  Record<key, number>>` and `pendingQuorumReads`.
- `replicationEvents.ts`: extend `ConsistencyLevel` to include
  `"quorum"`; add `quorum-read-forward`/`quorum-read-response` message
  kinds; add `version` to relevant payloads.
- `replicationReducer.ts`: `WRITE` now increments the per-key version
  counter and stamps it on the `replicate` message. `READ` with
  `consistency: "quorum"` fans out to every other alive node, counts
  its own local (value, version) as the first response.
- `replicationBehaviors.ts`: handle `quorum-read-forward`/`-response`
  delivery, accumulate into `pendingQuorumReads`, resolve once majority
  reached (highest version wins), emit `READ_SERVED` with
  `consistency: "quorum"`.
- Tests: quorum read reconciles two differing versions correctly,
  resolves once exactly majority responses arrive (not before), never
  resolves if majority is unreachable, interacts correctly with
  fault-injection on the fan-out messages, determinism.

## Milestone 40 — Registry entry, controls, inspector

- `moduleRegistry.tsx`: `quorum` entry, same topology/engine.
- `QuorumControls` (new): Write inputs + 3-way mode selector
  (Async/Sync/Quorum), Read section + 3-way consistency selector
  (Eventual/Strong/Quorum), node selector reused.
- Inspector: extend node detail to show per-key version and a static
  majority-threshold label ("majority: 3 of 4").
- Route smoke-test `/modules/quorum`.

## Milestone 41 — Guided steps, quiz, challenges, polish pass

- `quorumGuidedSteps.ts`, `quorumQuiz.ts`, `quorumChallenges.ts` per the
  design doc's content plan.
- Full test/lint/build cycle + route smoke test.
- Accessibility/polish check on the new `QuorumControls` (labels,
  `aria-pressed` on both 3-way toggles) built in from the start, then
  verified as a hypothesis during this pass, not assumed correct.

Four milestones total (38-41) — the two engine milestones (quorum
writes, quorum reads) are kept separate because quorum reads are a
genuinely new fan-out/reconcile mechanic, not a threshold change to
something that already exists the way quorum writes are.

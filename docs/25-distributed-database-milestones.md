# 25 — Distributed Database Milestones

Continues the project's global milestone numbering (last used: 41, in
[23-quorum-milestones.md](./23-quorum-milestones.md)).

## Milestone 42 — Raft engine: make log entries and commits fully derivable

- `raftEvents.ts`: add `value: string` to `LogEntryAppendedPayload`; add
  `nodeId: string` to `LogEntryCommittedPayload`.
- `raftReducer.ts`: `SUBMIT_ENTRY`'s `logEntryAppendedEvent` call now
  includes the entry's `value`; `tryAdvanceCommitIndex`'s
  `logEntryCommittedEvent` calls now include the leader's own `nodeId`.
- `raftBehaviors.ts`: the `AppendEntries`-handling branch where a
  follower's local `commitIndex` advances now also emits
  `logEntryCommittedEvent` with that follower's `nodeId`, whenever the
  new value is actually higher than before (never redundantly).
- Update existing `raft.test.ts` assertions that check
  `LOG_ENTRY_COMMITTED`/`LOG_ENTRY_APPENDED` payload shape to expect the
  new fields; add new tests confirming per-follower commit events fire
  correctly (including during a partition, where a cut-off follower's
  commitIndex must NOT advance).
- No behavior change to commit safety, election, or replication timing —
  this milestone only makes existing state transitions observable that
  previously weren't.

## Milestone 43 — KV store derivation

- Define the `"key=value"` encoding convention for `SUBMIT_ENTRY`'s
  `value` field (a small parse/format helper, not a new action type).
- New hook `useKvStore.ts`: `deriveKvStoreForNode(events, nodeId, tick)`
  — a node's own committed key-value view, built from that node's own
  `LOG_ENTRY_APPENDED` entries up through its own
  per-node `LOG_ENTRY_COMMITTED` progress.
- Tests: empty store, single key, overwrite, a follower's view lagging
  behind the leader's until its own commit catches up, a partitioned
  follower's view staying frozen even while the reachable majority keeps
  committing.

## Milestone 44 — Registry entry, controls, inspector

- `moduleRegistry.tsx`: `distributed-database` entry, Raft's existing
  5-node topology (`RAFT_NODE_IDS`/`RAFT_LINKS`/`RAFT_NODE_POSITIONS`,
  reused directly as `raft`/`fault-injection` already do).
- `DatabaseControls` (new): node selector + key/value inputs + PUT
  button (dispatches `SUBMIT_ENTRY` with the encoded value); a separate
  node selector + key input + GET button that only computes and
  displays a derived answer, no dispatch.
- Inspector: extend node detail with that node's own KV store contents
  and its own local commit index (not just the cluster-wide one Raft's
  existing detail view shows).
- Route smoke-test `/modules/distributed-database`.

## Milestone 45 — Guided steps, quiz, challenges, polish pass

- `distributedDatabaseGuidedSteps.ts`, `distributedDatabaseQuiz.ts`,
  `distributedDatabaseChallenges.ts` per the design doc's content plan —
  PUT/commit/GET, survive a leader failure, observe a partitioned
  follower's frozen KV view.
- Full test/lint/build cycle + route smoke test.
- Accessibility/polish check on `DatabaseControls` built in from the
  start, then verified as a hypothesis during this pass.

Four milestones total (42-45). Unlike every module since Consistency,
this one touches an *already-shipped* module's engine (Raft) rather than
only adding new code — flagged explicitly since it's the first time in
this series that finishing the capstone requires revisiting a
module that was previously considered "done."

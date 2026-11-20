# 14 — Module Design: Fault Injection Deep-Dive

## Why this module, and why now

Per [08-module-roadmap.md](./08-module-roadmap.md), Module 8 is explicitly
not a new algorithm: "A dedicated module (not just 'the fault menu,'
which exists from Module 0 onward) focused on *composing* faults against
Raft specifically: partition the leader away from a majority, kill a
node mid-election, delay just the vote responses. Goal: the learner
leaves confident predicting Raft's behavior under adversarial timing,
not just its happy path."

This is a different *shape* of module from Election or Raft: it teaches
no new state machine. It reuses Raft's engine (`src/modules/raft`)
unchanged and pairs it with a second, differently-themed route whose
guided steps/quiz/challenges specifically script **composed, adversarial
timing** — faults stacked on faults — rather than one fault at a time.
Per the roadmap's own characterization, this keeps it the lightest
remaining module: mostly content, not new protocol logic.

## The one real engine gap this module exposes

"Delay just the vote responses" cannot be scripted with what Raft's
reducer currently supports. Raft has whole-link faults (`KILL_NODE`,
`PARTITION_NETWORK`, `HEAL_PARTITION`, `SET_LINK_CONFIG`) but no
**per-message** faults — Networking's `DROP_MESSAGE` / `REORDER_MESSAGE`
/ `DUPLICATE_MESSAGE` (acting on one specific in-flight message a
learner has selected) were never added to Raft's action set.

This also means `FaultInjectionMenu` — already mounted generically for
every module — has been dispatching these three actions unconditionally
regardless of which module is loaded since Election's Milestone 15. The
Milestone 23 defensive `default` case in every reducer means clicking
them against Raft or Election today no longer *crashes* the engine (it
silently no-ops), but they've never actually *worked* for either module.
This module is the first real reason to fix that for Raft specifically
— Election isn't in scope here per the roadmap's framing (Module 8 is
about Raft), so its message-level faults remain a documented gap, not a
regression, to revisit if a future module needs them.

### The fix: add message-level faults to Raft's own action set

`DROP_MESSAGE`, `REORDER_MESSAGE`, `DUPLICATE_MESSAGE` are added to
`RaftAction`/`raftReducer.ts`, implemented identically to
`networkingReducer.ts`'s versions (same validation, same shared
`messageDroppedEvent`/`messageReorderedEvent`/`messageDuplicatedEvent`
factories, same `scheduleDelivery`-equivalent re-scheduling for a
reordered message). This is a real, scoped engine change — not "just
content" — but it's mechanical: no new concept, just extending Raft's
message lifecycle with the same three operations Networking already
proved out. Once added, these become permanent, general capabilities of
the base Raft module (available in `/modules/raft` too, not just this
new module) — a natural byproduct of "every module's faults are engine
primitives," not something this module's content needs to duplicate.

Deliberately **not** added here: any new fault *kind* beyond what
Networking already established. Composing existing faults is the
lesson; inventing new fault types is out of scope.

## What this module actually is

A second registry entry (`fault-injection`) with its **own** route,
explanation, guided steps, quiz, and challenges — but `createModule:
() => createRaftModule([...])`, the exact same factory the `raft` entry
uses. Same topology (5 lettered nodes, complete graph) for consistency;
no new `src/modules/fault-injection` folder, since there is no new
simulation logic to put in one. This is the first module in the
platform where "a module" is purely a *content* identity layered on an
existing engine, which is exactly what the roadmap anticipated Module 8
being.

## Learning objectives

After this module, a learner should be able to predict, before running
the scenario:

1. What happens when a node crashes **mid-election** (a candidate dies
   before it reaches a majority) — does progress stall, or does the
   remaining cluster route around it via the normal timeout mechanism?
2. What happens when a **specific** vote-response is delayed long enough
   that it arrives after the candidate has already moved on (timed out
   and started a new term) — is a stale, late response ever mistakenly
   counted? (It shouldn't be — this directly exercises the
   `response.term !== candidate.currentTerm` staleness guard already in
   `raftBehaviors.ts`.)
3. What happens when a request-vote to one specific voter is dropped —
   does the election still succeed from the remaining voters, or does it
   need a retry?
4. What happens when a follower receives a **duplicated** AppendEntries
   — is its log/commitIndex affected at all, or is delivery already
   safely idempotent?
5. What happens when faults are **composed** — e.g., partition the
   leader into a minority *and* kill one of the majority nodes *and*
   delay a vote response, all in the same scenario — building the
   confidence that Raft's guarantees hold under realistic, messy timing,
   not just one clean fault at a time.

## Guided lessons (planned; final copy written during content-pass milestone)

1. Start an election on node A, then immediately kill a different
   candidate mid-race (if a concurrent election is happening) or kill A
   itself right after it becomes a candidate but before any vote
   arrives — observe the cluster still converges via another node's
   timeout.
2. Start an election, let one voter grant a vote, then **reorder**
   (delay) that vote-response by enough ticks that the candidate's own
   election timeout fires first and it restarts at a new term — observe
   the stale vote-response arrives late and is silently ignored (no
   double-counted vote, no incorrect leader).
3. Start an election and **drop** the request-vote message to one
   specific voter — observe the election still succeeds if a majority
   of the *remaining* voters grant, and fails/retries otherwise.
4. Once a leader exists, **duplicate** one of its heartbeat
   (AppendEntries) messages to a follower — observe the follower's log
   and commitIndex are unaffected by processing the same message twice.
5. Compose: partition the leader into a minority, kill one node in the
   majority, and drop a vote-response during the majority's own
   automatic re-election — confirm the majority still converges on
   exactly one new leader despite three simultaneous faults.

## Challenges (planned)

- Cause a vote to arrive too late to count (reorder a vote-response past
  the candidate's own timeout) and confirm via the inspector that the
  candidate's final term/leader is unaffected by the late arrival.
- Cause an election to succeed despite one voter's request-vote being
  dropped.
- Compose at least three simultaneous faults (any combination of
  kill/partition/drop/reorder/duplicate) in one scenario and still reach
  exactly one leader.

## Predictive quiz (planned)

- "A candidate is waiting on votes. You reorder one voter's response so
  it arrives 20 ticks late — well after the candidate's own timeout
  fires and it restarts at a new term. When that late response finally
  arrives, what happens?" (Nothing — it's silently ignored, term
  mismatch.)
- "You duplicate a leader's heartbeat to one follower. Does the
  follower's log end up with a duplicate entry?" (No — AppendEntries
  processing is idempotent by construction.)

## What's explicitly out of scope

- Any new fault *kind* — only the three existing per-message operations
  (drop/reorder/duplicate), newly wired to Raft.
- Adding these same per-message faults to Election — not needed by this
  module's scope (Module 8 is Raft-specific per the roadmap); left as a
  known, documented gap rather than silently fixed here.
- Any change to Raft's core protocol logic — this module proves the
  existing logic already handles adversarial timing correctly; if a
  scenario reveals it doesn't, that's a bug fix to `raftBehaviors.ts`
  itself, reported the same way prior milestones' real bugs were, not a
  new feature.

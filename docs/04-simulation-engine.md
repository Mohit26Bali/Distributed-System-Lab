# 04 — Simulation Engine

## Scope and non-goals

The engine models distributed algorithms **faithfully enough to teach
their real behavior**, including real failure modes. It is explicitly
**not**:

- A production-grade consensus/replication library.
- Modeling real OS/network-stack details (TCP retransmission internals,
  actual byte-level serialization, real clock drift in nanoseconds).
- Performance-oriented. It should comfortably handle the node counts a
  human can visually track (roughly up to ~9-12 nodes) and the tick
  counts of one classroom-length session. It is not designed to simulate
  thousands of nodes.

The line: if a real-world detail changes *what the learner should
conclude* about the algorithm's behavior (e.g. "a majority partition can
still make progress"), it's in scope. If it only changes performance
characteristics or wire-format trivia, it's out of scope.

## Core abstractions

### Node

A `Node` has an id, a role (module-defined — e.g. `leader`/`follower`/
`candidate` for Raft), a lifecycle status (`alive`/`crashed`/
`partitioned`), and module-specific state (e.g. Raft's `currentTerm`,
`log`, `votedFor`). The engine core only knows about id/status; role and
module state are opaque payloads it stores but does not interpret.

### Message

A `Message` travels over a `Link` between two nodes and has: sender,
recipient, a send tick, a scheduled-delivery tick (computed from the
link's current latency model), a payload (module-defined), and a
lifecycle (`in-flight` / `delivered` / `dropped`). Messages are the unit
that fault injection (delay/drop/reorder/duplicate) acts on.

### Link / NetworkModel

The `NetworkModel` owns the topology (which nodes can reach which) and,
per link, a latency function and a fault state (partitioned or not,
extra delay, drop probability). Node-to-node connectivity is derived
from this, not hardcoded per module — so "partition the network" is a
network-model operation usable by every module, not something Raft has
to reimplement.

### Scheduler

The `Scheduler` owns the tick loop and a `TimerQueue` (a priority queue
keyed by delivery tick) holding: pending message deliveries, node
timers (e.g. Raft's election timeout, heartbeat interval), and scheduled
fault expirations (e.g. "this partition heals at tick 40"). Advancing one
tick means: pop everything due at the new tick, feed each to the owning
module's reducer, collect events, commit.

### Event

The append-only unit of history (shape given in
[01-architecture.md](./01-architecture.md)). Every mutation the engine
ever performs is representable as one or more events; nothing changes
state outside of "apply this event."

### EventLog

An ordered, append-only array of events plus the snapshot at tick 0.
Any snapshot at tick N is derivable by replaying events `[0..N]` — the
engine may cache snapshots at intervals for scrub performance, but the
event log is the source of truth, snapshots are a cache.

## Module contract

A module (`src/modules/<name>`) plugs into the generic engine by
providing:

```ts
interface SimulationModule<ModuleState, ModuleAction> {
  id: string;
  initialState(config: ModuleConfig): ModuleState;

  // Pure: given current state + an incoming action (message delivery,
  // timer fire, injected fault, user command), return next state + events.
  reduce(
    state: ModuleState,
    action: ModuleAction,
    ctx: ReduceContext        // read-only: network model, current tick, PRNG
  ): { state: ModuleState; events: SimEvent[] };

  // What a node does on a timer it scheduled (e.g. election timeout fired)
  onTimer?(nodeId: string, timerId: string, state: ModuleState, ctx: ReduceContext):
    { state: ModuleState; events: SimEvent[] };
}
```

The engine core (`src/simulation/engine`) never imports a concrete module.
It holds a `SimulationModule` reference and calls these hooks generically.
This is what keeps `Engine.ts`/`Scheduler.ts` small and free of
"if raft then... if quorum then..." branching, and it's what makes adding
Module 9 later an additive change, not a core-engine rewrite.

## Determinism requirements (restated precisely)

- All randomness goes through `SeededRandom`, seeded from the simulation
  config. No module or engine file calls `Math.random()` directly — this
  is enforced by lint (`no-restricted-syntax` targeting `Math.random`
  inside `src/simulation/**` and `src/modules/**`).
- No wall-clock reads (`Date.now`, `performance.now`) inside reducers.
  Ticks are the only notion of time the engine has.
- Reducers are pure functions: same `(state, action, ctx)` in, same
  `(state, events)` out, no hidden mutation of `state` or `ctx`.

Determinism is verified by a standing test: run a fixed scenario (config
+ scripted fault/command sequence) twice and assert the resulting event
logs are byte-identical.

## Fault injection model

Faults are not special-cased hacks bolted onto specific modules — they
are **commands the NetworkModel and Scheduler already know how to
handle**, because faults are just perturbations of the same primitives
every module already uses (links have latency/drop-rate; nodes have
alive/crashed status):

- **Kill node**: sets node status to `crashed`; scheduler stops
  delivering timers to it; in-flight messages to/from it are still
  delivered or dropped per existing rules (a message already in flight
  when a node dies either arrives at a dead node and is dropped, or was
  already sent by it and still lands — this asymmetry is itself
  teachable and must be visible, not hidden).
- **Partition network**: splits the node set into groups; the
  NetworkModel treats cross-group links as 100%-drop until healed.
- **Delay / drop / reorder / duplicate a message**: mutates a specific
  in-flight `Message`'s scheduled delivery tick, or its lifecycle.
- **Clock skew** (later module): offsets a node's *perceived* tick
  relative to the global scheduler tick, for teaching clock-related
  bugs.

Because these are engine/network-level primitives, every module gets
fault injection for free — a Raft module author does not write partition
logic, they only need their reducer to correctly handle "some expected
message never arrives" and "some expected message arrives very late,"
which is exactly the general case they need to handle for correctness
anyway.

## Testing strategy for the engine

- **Unit tests per module reducer**: given a hand-constructed state and
  action, assert exact output state + events. These are the bulk of
  coverage and the cheapest to write.
- **Scenario/property tests at the engine level**: run a full scenario
  (e.g. "5-node Raft cluster, kill the leader at tick 20") and assert
  invariants over the resulting event log/final state (e.g. "exactly one
  leader is ever elected per term," "committed log entries are never
  contradicted on any node") rather than asserting an exact trace, since
  legitimate timing nondeterminism-by-design (randomized election
  timeouts) means the exact trace varies by seed.
- **Determinism regression test**: described above — same seed + same
  input command sequence ⇒ identical event log.
- **Golden replays**: a handful of hand-picked scenarios (used directly
  in guided-lesson steps) have their event logs committed as fixtures;
  a diff against the fixture is a strong signal something in a shared
  module changed behavior unexpectedly.

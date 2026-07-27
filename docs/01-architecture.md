# 01 — Architecture

## Guiding principle: Simulation First

The single most important architectural decision in this project is that
**the simulation engine is a standalone, UI-independent system**, and the
entire application is built as a renderer on top of it.

Concretely: the engine has no imports from React, no imports from Zustand,
no DOM references, no knowledge that it is being visualized at all. You
could run the engine in a Node script with no UI, or in a Web Worker, or
in a unit test, and get identical behavior. This is not a nice-to-have —
it's the property that makes every other commitment in
[00-vision.md](./00-vision.md) achievable:

- If the engine can be run headless, it can be run deterministically and
  tested exhaustively (see "Determinism" below).
- If the UI cannot mutate simulation state directly, it cannot ever draw
  something that didn't happen — because the only channel it has is
  reading events the engine already committed to history.
- If the engine emits a linear, immutable event log, "rewind" and
  "scrub" are just "re-render at event index N," not a separate feature
  that has to be built and kept in sync.

## The three layers

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer            (src/app, src/components, src/hooks) │
│  - Renders simulation state                                │
│  - Dispatches *intents* (user actions) to the engine        │
│  - Never mutates simulation state directly                  │
└───────────────────────────▲─────────────────────────────┘
                            │ reads (subscribes to store)
┌───────────────────────────┴─────────────────────────────┐
│  Bridge Layer          (src/store)                         │
│  - Zustand store(s) that mirror engine state for React      │
│  - Subscribes to the engine's event stream                  │
│  - Translates UI intents into engine commands                │
└───────────────────────────▲─────────────────────────────┘
                            │ commands / events
┌───────────────────────────┴─────────────────────────────┐
│  Simulation Layer      (src/simulation, src/modules)       │
│  - Deterministic, framework-agnostic                         │
│  - Owns all "what happened" logic                            │
│  - Emits immutable events; never reaches back into the UI    │
└─────────────────────────────────────────────────────────┘
```

The dependency arrow only ever points **up**. The simulation layer does
not know the bridge layer exists; the bridge layer does not know which
components are rendering it. This is enforced by folder boundaries (see
[02-folder-structure.md](./02-folder-structure.md)) and, practically, by
lint rules that forbid `src/simulation/**` from importing anything from
`react`, `zustand`, or `src/components`.

## Core model: tick → events → state

The engine runs on **discrete ticks**, not wall-clock time. A tick is one
step of the simulation scheduler. On each tick:

1. The scheduler determines which pending actions are due (message
   arrivals, timer expirations, scheduled faults).
2. Each due action is handed to the relevant module's reducer (e.g. the
   Raft module's "on message received" handler).
3. The reducer computes a new node/cluster state and returns a list of
   **events** describing what changed — it does not mutate anything in
   place.
4. The scheduler commits those events to the **event log** (append-only)
   and applies them to produce the next immutable state snapshot.
5. The event log entry is the *only* thing published outward.

```ts
// Illustrative shape, not final API
type Tick = number;

interface SimEvent {
  id: string;
  tick: Tick;
  type: string;          // e.g. "MESSAGE_SENT", "NODE_CRASHED", "VOTE_GRANTED"
  moduleId: string;       // which module produced it, e.g. "raft"
  payload: unknown;       // event-specific, discriminated by `type`
  causedBy?: string[];    // ids of events that directly caused this one
}

interface SimSnapshot {
  tick: Tick;
  nodes: Record<string, NodeState>;
  network: NetworkState;
  moduleState: unknown;   // module-specific (e.g. RaftState)
}
```

Wall-clock playback speed (the "play" button running at 1x/2x/0.5x) is a
UI-layer concern: it's just a `setInterval`/`requestAnimationFrame` loop
that repeatedly asks the engine "advance one tick" at some cadence. The
engine itself has no concept of real seconds — this is what makes step,
pause, and rewind trivially consistent with play: they're all just
"what tick am I requesting."

## Determinism

Given the same initial configuration and the same sequence of injected
faults/user actions, the engine must produce the exact same event log,
every time. This requires:

- No `Date.now()`, `Math.random()`, or other ambient nondeterminism
  inside `src/simulation/**`. Randomness (e.g. simulated network jitter)
  is drawn from a seeded PRNG that is itself part of the simulation
  config, so a given seed reproduces a given run.
- No reliance on object iteration order beyond what's guaranteed, no
  reliance on `Map`/`Set` insertion-order edge cases that vary by engine.

Determinism is what makes "replay" meaningful (replaying isn't
approximate, it's exact) and what makes the engine unit-testable without
flaking.

## Events as the animation contract

The UI never says "animate a packet moving from A to B because the user
clicked send." It says "the user clicked send," which becomes an intent
sent to the engine; the engine decides whether/when that produces a
`MESSAGE_SENT` event; and only once that event exists in the log does
any component render a moving packet. See
[06-animation-system.md](./06-animation-system.md) for how events map to
animation primitives.

This is the direct mechanism behind the vision-doc rule "never animate
something that didn't happen" — it's not a discipline the UI team has to
maintain by hand, it's structurally true because there is no other path
to triggering an animation.

## Commands vs. events (the only two message types crossing the boundary)

- **Commands** flow UI → engine. They represent user intent: "start
  simulation," "kill node 3," "step forward one tick," "set message delay
  to 200ms," "submit a write to node 1." Commands can be *rejected* (e.g.
  you can't kill a node that's already dead) — rejection is reported back
  synchronously, it is not an event in the log, because nothing happened.
- **Events** flow engine → UI (via the store). They represent committed
  fact: something the engine did happen at tick N. Events are never
  rejected, retried, or mutated after creation — history is append-only.

## Why not just put simulation logic in Zustand directly?

It would be less code up front, and it's the tempting shortcut. It's
rejected because:

- It couples "what happened" to "what re-renders," which makes step/
  rewind/replay require special-casing instead of falling out for free.
- It makes the engine untestable without a React/Zustand test harness.
- It makes it impossible to ever run a simulation headless — e.g. for
  auto-generating a "golden" reference run for a challenge, or for
  running the engine in a Web Worker later if simulations get heavy
  (many nodes, long histories) — without a rewrite.

The cost we accept: an extra translation layer (the store) that mirrors
engine state into something React can subscribe to efficiently. That
tradeoff is spelled out in [05-state-management.md](./05-state-management.md).

## Modules plug into the engine, they don't extend it

`src/modules/*` (networking, replication, cap, quorum, election, raft,
...) are not subclasses of some monolithic `Engine` class. Each module
supplies:

- an initial state shape,
- a reducer (`(state, action) => { state, events }`),
- a set of node "behaviors" (what a node running this module does when
  it receives a message or a timer fires).

The core engine (`src/simulation/engine`) is generic over "some module is
plugged in" — it does not know what Raft is. This keeps the engine small
and keeps module-specific teaching logic (e.g. "highlight the moment a
term number changes") out of core scheduling code. Module authoring is
covered in [04-simulation-engine.md](./04-simulation-engine.md).

## Where this leaves the UI

The UI's job is entirely: render the latest snapshot, render the event
log as a scrubbable timeline, translate clicks/drags into commands, and
animate transitions between consecutive snapshots using the event that
caused the transition as the animation's semantic source. UI components
must not contain distributed-systems logic (e.g. a component must never
decide "this write is now committed" — it only ever reads that the engine
already decided that, via an event).

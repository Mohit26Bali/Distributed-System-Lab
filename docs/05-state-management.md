# 05 — State Management

## Two kinds of state, kept deliberately separate

1. **Simulation state** — owned entirely by the engine (
   [04-simulation-engine.md](./04-simulation-engine.md)). React never
   owns this; it only mirrors it.
2. **UI state** — panel widths, which node is "selected" for the
   inspector, which tab is open, playback speed preference, whether the
   fault menu is open. This is ordinary UI state with no simulation
   meaning, and it's fine for it to live in normal React/Zustand
   patterns without ceremony.

Mixing these is the single biggest way this architecture would erode
over time (e.g. "selectedNodeId" quietly growing into "and also let's
just compute its Raft term here in the component" — that's simulation
logic leaking into UI state). The store is split into two files
(`simulationStore.ts`, `uiStore.ts`) specifically so this boundary has a
visible home and code review can catch violations by noticing an import
in the wrong file.

## `simulationStore` — the bridge, precisely

`simulationStore` does three things and nothing else:

```ts
interface SimulationStore {
  // Mirrored, read-only from the UI's perspective
  currentTick: number;
  snapshot: SimSnapshot;
  events: SimEvent[];          // full log up to currentTick
  status: 'idle' | 'running' | 'paused' | 'finished';

  // The only way the UI is allowed to affect the simulation
  dispatch: (command: SimCommand) => CommandResult;

  // Playback (still just "ask the engine to move," see below)
  play: (speed?: number) => void;
  pause: () => void;
  step: (direction: 1 | -1) => void;
  seek: (tick: number) => void;
}
```

Internally, the store holds a reference to a live `Engine` instance
(created per module session) and:

- On mount / module load, constructs the engine with the module's
  initial config.
- Subscribes to the engine's event emissions (the engine itself is
  framework-agnostic but exposes a plain callback/observer hook — e.g.
  `engine.onEvents((events) => ...)` — it does not import Zustand either;
  the store is the one that wires that callback into `set()`).
- On every new committed tick, updates `currentTick`, `snapshot`, and
  appends to `events`, in one `set()` call (batched, so React doesn't
  re-render once per field).
- `dispatch` forwards a command to `engine.dispatch(command)` and
  returns whatever accept/reject result the engine gives back
  synchronously — it does not itself decide whether a command is valid.

**`seek(tick)` is not a special engine feature** — it re-derives
`snapshot` for tick N from the cached snapshot/event-log replay described
in [04-simulation-engine.md](./04-simulation-engine.md) and updates the
store's view. This is the direct payoff of the event-log architecture:
scrubbing is "ask for a different derived snapshot," not a parallel code
path from live playback.

## Why Zustand (and not Context, not Redux)

- Context re-renders every consumer on every change unless you hand-roll
  selector splitting; a running simulation ticking multiple times a
  second makes that expensive fast. Zustand's selector-based
  subscriptions (`useSimulationStore(s => s.snapshot.nodes[id])`) let a
  `NodeGlyph` re-render only when *its* node changed, which matters once
  there are a dozen nodes and packets animating continuously.
- Redux's ceremony (actions/reducers/middleware) would duplicate the
  command/event structure the engine already has — we'd be modeling the
  same "action → new state" shape twice, once in the engine and once in
  Redux, for no benefit.
- Zustand stores are plain and easy to keep thin, which matters because
  the store must resist growing simulation logic inside it (see below).

## What must never go in `simulationStore`

- Any code that decides *whether* something happened (e.g. "is this
  write committed" logic) — that's a reducer's job in
  `src/modules/<name>`.
- Any code that computes derived teaching state ("has the learner seen a
  leader election yet") — that's learning-progress state, and it lives
  in its own store slice (or `uiStore`, if simple enough), sourced from
  reading events, never by re-deriving simulation facts independently.
- Direct DOM/animation triggering. The store publishes state; components
  and `06-animation-system.md`'s primitives decide how to animate a
  transition between two consecutive published states.

## `uiStore`

Ordinary Zustand state: panel collapse/expand, selected node/message id
for the inspector, active timeline zoom range, playback speed
preference, active guided-lesson step index. No engine references. Fine
to grow organically per-component as needed, unlike `simulationStore`
which should stay minimal and stable.

## `moduleRegistry`

A small store/module describing which learning module is currently
active and its config (node count, initial topology, which
optional-fault types are enabled for this lesson). This is what
`src/app/modules/[moduleId]/page.tsx` reads to know which
`SimulationModule` implementation to hand to a freshly constructed
engine. It is metadata about *which* simulation to run, not simulation
state itself.

## Data flow, end to end

```
User clicks "Kill Node 3"
        │
        ▼
FaultInjectionMenu.tsx  → simulationStore.dispatch({ type: 'KILL_NODE', nodeId: '3' })
        │
        ▼
Engine.dispatch(command) → Scheduler validates → module.reduce(...) → events[]
        │
        ▼
engine emits events (observer callback)
        │
        ▼
simulationStore's subscription updates { snapshot, events, currentTick }
        │
        ▼
Subscribed components re-render:
  - NodeGlyph for node 3 reads new status → Framer Motion transitions to "crashed" visual
  - Timeline appends a new EventMarker
  - Inspector, if node 3 is selected, shows updated state
```

At no point does a component call anything on the engine directly, and
at no point does the engine or a module reducer know a React tree
exists.

## Performance notes

- `snapshot` and `events` are large-ish and update frequently during
  playback; components must select narrowly (`useSimulationStore(s =>
  s.snapshot.nodes[id])`, not `useSimulationStore(s => s.snapshot)`) to
  avoid canvas-wide re-renders on every tick.
- For longer sessions, `events` in the store can be windowed (e.g. only
  the last N plus tick indices for seeking further back, re-fetched from
  the engine's own log on demand) if profiling shows it's needed — not a
  v1 concern, noted here so it isn't a surprise later.

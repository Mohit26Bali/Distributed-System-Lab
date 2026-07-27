# 09 — Implementation Roadmap

This roadmap sequences implementation into milestones consistent with
[01-architecture.md](./01-architecture.md),
[02-folder-structure.md](./02-folder-structure.md), and the rest of
`docs/`. It does not change any architectural decision already made.

## How to read this document

- Each milestone is scoped to ~1-3 hours and ends with **something
  running in a browser** that can be looked at and clicked, not just
  code that compiles.
- Milestones build strictly on top of each other — nothing here jumps
  ahead to an abstraction (a second module, a generic plugin registry,
  a persistence layer) before a concrete need for it exists, per YAGNI.
  Where the architecture docs describe a general mechanism (e.g. "any
  module can plug into the engine"), the roadmap still builds the
  _first_ concrete instance before generalizing, and only generalizes
  when a second real caller shows it's needed.
- "Files created" / "Files modified" reference the structure in
  [02-folder-structure.md](./02-folder-structure.md); a milestone may
  create a leaner version of a file than the doc's eventual shape — the
  doc describes the destination, not the first commit.
- No code is written as part of producing this roadmap. Each milestone
  begins only once explicitly approved, per the standing development
  process (explain design → tradeoffs → code → testing strategy → wait).

## Milestone map (overview)

| #   | Milestone                                       | Depends on          |
| --- | ----------------------------------------------- | ------------------- |
| 1   | Project setup + static three-panel layout       | —                   |
| 2   | Simulation canvas with static nodes             | 1                   |
| 3   | Headless engine capable of ticking              | — (parallel to 1-2) |
| 4   | Engine wired to canvas via store                | 2, 3                |
| 5   | First real behavior: packets moving             | 4                   |
| 6   | Timeline (scrubbable event log)                 | 5                   |
| 7   | Inspector panel                                 | 5                   |
| 8   | Playback controls (play/pause/step/speed)       | 4, 6                |
| 9   | Fault injection (kill node, drop message)       | 5, 8                |
| 10  | Learning panel + module routing                 | 1, 9                |
| 11  | Guided interaction steps                        | 10                  |
| 12  | Quiz / challenge checking                       | 6, 11               |
| 13  | Module 1 (Networking) full content pass         | 9, 12               |
| 14  | Polish, empty states, reduced-motion, a11y pass | 13                  |

Milestones 1-2 and 3 can technically be built in either order (the
engine doesn't need the UI to exist); they're numbered sequentially
here only for narrative clarity. Everything from Milestone 4 onward is
strictly sequential.

---

## Milestone 1 — Project setup + static three-panel layout

### Goal

A running Next.js app, styled with Tailwind + shadcn/ui, showing the
dark-themed four-region layout from
[03-design-system.md](./03-design-system.md) — left/center/right/bottom
— with placeholder content in each region. No simulation logic exists
yet; this milestone is pure shell.

### Features implemented

- Next.js (App Router) + TypeScript + Tailwind project bootstrap via
  pnpm.
- shadcn/ui initialized, dark theme as default (no theme toggle yet —
  not needed until a real requirement for light mode exists).
- Static, non-collapsible three-panel + bottom-bar layout with
  placeholder text in each region ("Learning panel", "Simulation
  canvas", "Inspector", "Timeline / controls").
- Base color tokens from [03-design-system.md](./03-design-system.md)
  wired into `globals.css`/Tailwind config (even though most are unused
  until later milestones).

### Files created

- `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- `src/app/layout.tsx`, `src/app/page.tsx` (redirects or links to a
  single hardcoded module route for now)
- `src/app/modules/[moduleId]/page.tsx` — composes the four regions
- `src/components/ui/*` — shadcn primitives as generated
- `src/lib/cn.ts`

### Files modified

- None (greenfield).

### Testing strategy

- `pnpm build` succeeds with no type errors.
- Manual: `pnpm dev`, confirm all four regions render, dark background,
  no layout overflow at common viewport widths (1280px, 1440px,
  ultrawide).

### Demo checklist

- [ ] `pnpm dev` starts without errors
- [ ] Four regions visible: left, center, right, bottom bar
- [ ] Dark theme applied (no default white flashes)
- [ ] Resizing the window doesn't break the layout

### Future considerations (do not implement yet)

- Panel collapse/expand (icon-rail state) — deferred until there's
  real content to want to hide.
- Mobile/tablet stacking layout — deferred until desktop is solid.
- Light theme — not currently planned at all; revisit only if asked.

---

## Milestone 2 — Simulation canvas with static nodes

### Goal

The center panel renders a fixed set of hardcoded nodes (e.g. 3 circles
labeled "Node A/B/C") using React Flow, styled per the node-glyph
language in [03-design-system.md](./03-design-system.md). Still no
engine — node positions and states are hardcoded React state/props.

### Features implemented

- React Flow integrated as the canvas renderer.
- `NodeGlyph` component: circle, label, status border (all nodes
  "healthy" for now — no crashed/leader states yet, since there's no
  engine to produce those states truthfully).
- `LinkLine` component: static edges between the hardcoded nodes.
- Basic pan/zoom (React Flow default behavior) confirmed working.

### Files created

- `src/components/simulation/SimulationCanvas.tsx`
- `src/components/simulation/NodeGlyph.tsx`
- `src/components/simulation/LinkLine.tsx`

### Files modified

- `src/app/modules/[moduleId]/page.tsx` — mounts `SimulationCanvas` in
  the center region instead of placeholder text.

### Testing strategy

- Manual only at this stage (nothing stateful to unit test yet):
  confirm 3 nodes + connecting edges render, pan/zoom works, glyphs
  match the design system's node visual spec.

### Demo checklist

- [ ] 3 labeled node glyphs visible in the canvas
- [ ] Edges connect them per a hardcoded topology
- [ ] Pan and zoom work
- [ ] Visual style matches [03-design-system.md](./03-design-system.md)
      (colors, not final polish)

### Future considerations (do not implement yet)

- Node status variants (leader/candidate/crashed) — no engine to drive
  them truthfully yet; adding them now would risk animating something
  that didn't happen, which is exactly the rule this project exists to
  avoid.
- Auto-layout for arbitrary topologies — hardcoded positions are fine
  until a real module needs a different shape.

---

## Milestone 3 — Headless engine capable of ticking

### Goal

A standalone, framework-free simulation engine that can be constructed,
advanced tick-by-tick, and produce an event log — verified entirely
through a script/test, with **no UI involvement**. This is the first
concrete proof that "simulation first" (per
[01-architecture.md](./01-architecture.md)) actually holds.

### Features implemented

- `Engine` with a minimal `Scheduler` and `TimerQueue`.
- A trivial built-in behavior for this milestone only (no module
  system yet): a "tick counter" that emits one `TICK` event per
  advance, just to prove the loop, event log, and snapshot mechanics
  work end to end.
- `EventLog`: append-only array, replay-to-snapshot function.
- Seeded PRNG utility (`SeededRandom`) created now even though nothing
  consumes randomness yet, because determinism must be true from the
  very first tick loop, not retrofitted later.

### Files created

- `src/simulation/engine/Engine.ts`
- `src/simulation/engine/Scheduler.ts`
- `src/simulation/engine/EventLog.ts`
- `src/simulation/engine/types.ts`
- `src/simulation/scheduler/SeededRandom.ts`
- `src/simulation/scheduler/TimerQueue.ts`

### Files modified

- None (isolated addition; not yet wired to `src/app`).

### Testing strategy

- Unit tests: construct engine, advance N ticks, assert event log has
  N `TICK` events with correct tick numbers.
- Determinism test: same seed, same advance sequence, twice ⇒
  byte-identical event logs (this test is written now and stays in the
  suite permanently — see [04-simulation-engine.md](./04-simulation-engine.md)).
- No manual/browser testing needed for this milestone — it's
  intentionally headless, and that's the thing being proven.

### Demo checklist

- [ ] A short Node/test script constructs an engine, advances 10 ticks,
      and prints/asserts 10 events
- [ ] Determinism test passes
- [ ] No import in `src/simulation/**` reaches into `react` or
      `zustand` (spot-check; lint rule for this lands in Milestone 4
      once there's a consumer to enforce the boundary against)

### Future considerations (do not implement yet)

- The generic `SimulationModule` plug-in contract from
  [04-simulation-engine.md](./04-simulation-engine.md) — this milestone
  hardcodes one trivial behavior; generalizing into a module interface
  happens in Milestone 5 once there are two real behaviors (tick
  counter + message passing) to generalize _from_, not before.
- Network model (links/latency/partitions) — needed starting Milestone
  5, not here.

---

## Milestone 4 — Engine wired to canvas via store

### Goal

The Milestone 3 engine is connected to the Milestone 2 canvas through a
real (if minimal) Zustand `simulationStore`, per
[05-state-management.md](./05-state-management.md). Clicking a button
advances the engine by one tick and the canvas re-renders from store
state — proving the full command → engine → event → store → render
loop with the simplest possible payload (the tick counter from
Milestone 3).

### Features implemented

- `simulationStore`: holds a live `Engine` instance, exposes
  `currentTick`, subscribes to engine events, exposes a `step()` action.
- A temporary "Advance Tick" button (bottom bar placeholder) calling
  `simulationStore.step()`.
- Canvas or a small debug readout displays `currentTick` from the store
  to prove the wiring, not because it's meaningful yet.
- ESLint rule added: `src/simulation/**` and `src/modules/**` may not
  import `react`, `zustand`, or `src/components` — enforced starting
  now, since Milestone 4 is the first point a violation is even
  possible.

### Files created

- `src/store/simulationStore.ts`
- `.eslintrc` (or flat config) rule additions for the layer boundary

### Files modified

- `src/app/modules/[moduleId]/page.tsx` — mounts the debug tick readout
  and the temporary advance button
- `src/components/simulation/SimulationCanvas.tsx` — reads
  `currentTick` from the store (still no per-node state changes yet)

### Testing strategy

- Unit test: `simulationStore.step()` advances the underlying engine
  and updates `currentTick`.
- Manual: click "Advance Tick" repeatedly in the browser, confirm the
  displayed tick count increments and matches what a direct engine call
  would produce.
- Lint check: intentionally add a throwaway `import { useState } from
'react'` inside `src/simulation/engine/Engine.ts`, confirm lint fails,
  then remove it — one-time proof the boundary rule is wired correctly.

### Demo checklist

- [ ] Clicking "Advance Tick" increments a visible counter
- [ ] Counter value matches engine event count
- [ ] Lint fails if simulation code imports React/Zustand

### Future considerations (do not implement yet)

- Real per-node visual state driven by events — Milestone 5.
- Play/pause/speed — Milestone 8. This milestone only proves manual
  single-step wiring.

---

## Milestone 5 — First real behavior: packets moving

### Goal

Replace the placeholder tick-counter behavior with the first real
module: a minimal **Networking** behavior (per
[08-module-roadmap.md](./08-module-roadmap.md) Module 1) where Node A
sends a ping to Node B over a link with simulated latency, and the
canvas shows an actual packet dot traveling between them, driven purely
by engine events. This is the milestone where
[06-animation-system.md](./06-animation-system.md)'s core rule first
becomes real and checkable: no dot moves unless a `MESSAGE_SENT`/
`MESSAGE_DELIVERED` event says so.

This is also the point where the generic `SimulationModule` contract
from [04-simulation-engine.md](./04-simulation-engine.md) is introduced
for real — generalized from the Milestone 3 tick-counter behavior and
this new ping behavior, now that there are two concrete cases to
generalize from.

### Features implemented

- `NetworkModel`: a link with a fixed latency value (no drop/partition
  yet — those are Milestone 9).
- Minimal `SimulationModule` interface + a first concrete module
  (`src/modules/networking`) implementing "node sends a ping on
  command; message arrives after N ticks."
- `Message`/`Link` domain types.
- `PacketDot` component + the first entry in an event→animation
  mapping table (per [06-animation-system.md](./06-animation-system.md)):
  `MESSAGE_SENT` → packet starts traveling; `MESSAGE_DELIVERED` →
  packet reaches destination and disappears.
- A temporary "Send Ping A→B" button to trigger the command.

### Files created

- `src/simulation/network/NetworkModel.ts`, `types.ts`
- `src/simulation/models/Node.ts`, `Message.ts`
- `src/simulation/events/networkEvents.ts`, `index.ts`
- `src/modules/networking/` (reducer, behaviors, state, events)
- `src/components/simulation/PacketDot.tsx`
- `src/hooks/useEventAnimations.ts` (first real version, one mapping
  entry)

### Files modified

- `src/simulation/engine/Engine.ts` — generalized to accept a
  `SimulationModule` rather than the hardcoded tick behavior
- `src/store/simulationStore.ts` — constructs the engine with the
  networking module; exposes `dispatch()` for the ping command
- `src/components/simulation/SimulationCanvas.tsx` — renders
  `PacketDot`s from animation-hook output

### Testing strategy

- Unit tests on the networking reducer: sending a ping produces a
  `MESSAGE_SENT` event immediately and a `MESSAGE_DELIVERED` event N
  ticks later, with no other side effects.
- Determinism test extended to this module (same command sequence
  twice ⇒ identical event log).
- Manual: click "Send Ping," watch a dot travel from A to B over the
  expected number of ticks, confirm it disappears exactly on the
  delivered tick (not before/after).

### Demo checklist

- [ ] Clicking "Send Ping A→B" produces a visible dot traveling A→B
- [ ] Dot's travel duration matches the link's configured latency
- [ ] No dot appears without a corresponding click/command
- [ ] Reducer unit tests + determinism test pass

### Future considerations (do not implement yet)

- Bidirectional/broadcast messaging, multiple simultaneous packets —
  add only once a module actually needs it (Module 2/Replication).
- Packet loss/delay fault injection — Milestone 9.
- Color-coding packets by traffic type (control vs. write) — deferred
  until a second traffic type exists to distinguish from (Milestone 13
  or whenever Replication-style writes are introduced).

---

## Milestone 6 — Timeline (scrubbable event log)

### Goal

The bottom panel shows the real event log from Milestone 5 as a
horizontal timeline with a marker per event, and clicking any point
seeks the simulation to that tick (per `seek()` in
[05-state-management.md](./05-state-management.md)) — the first proof
that "rewind" is free once the event-log architecture exists, not a
separately built feature.

### Features implemented

- `Timeline` component rendering one marker per tick that has events,
  spanning `[0, currentMaxTick]`.
- Click-to-seek: clicking a point calls `simulationStore.seek(tick)`,
  which replays the log up to that tick and updates `snapshot` — canvas
  re-renders at that historical state with no animation (per
  [06-animation-system.md](./06-animation-system.md)'s scrub rule).
- A visible "playhead" showing the current tick position.

### Files created

- `src/components/timeline/Timeline.tsx`
- `src/components/timeline/EventMarker.tsx`
- `src/hooks/useEventTimeline.ts`

### Files modified

- `src/store/simulationStore.ts` — implement `seek(tick)` using
  snapshot replay from the event log
- `src/app/modules/[moduleId]/page.tsx` — mounts `Timeline` in the
  bottom region, replacing its placeholder

### Testing strategy

- Unit test: `seek(tick)` produces a snapshot equal to replaying events
  `[0..tick]` from scratch, for several tick values including 0 and the
  max.
- Manual: send a few pings, then click various points on the timeline,
  confirm the canvas jumps (no animation) to the correct historical
  state each time, including back to a state with a packet mid-flight.

### Demo checklist

- [ ] Timeline shows a marker for each `MESSAGE_SENT`/`MESSAGE_DELIVERED`
      event
- [ ] Clicking a marker jumps the canvas to that exact tick, instantly
- [ ] Clicking a tick where a packet was mid-flight shows it mid-flight
      (not at start or end)
- [ ] Seek unit tests pass

### Future considerations (do not implement yet)

- Zooming/collapsing dense timeline regions — only relevant once
  sessions are long enough to be dense (post-Milestone 9/13).
- "Play from A to B" range replay — deferred to Milestone 8, which adds
  real playback.

---

## Milestone 7 — Inspector panel

### Goal

The right panel shows live detail for a selected node or message,
reading directly from the store — the first payoff of "the learner can
always ask why," per [00-vision.md](./00-vision.md).

### Features implemented

- Clicking a `NodeGlyph` selects it (`uiStore.selectedNodeId`); the
  inspector shows that node's current state from `snapshot`.
- Clicking a `PacketDot` selects the underlying message; the inspector
  shows its send tick, expected delivery tick, and payload.
- Basic empty state ("Select a node or message to inspect it").

### Files created

- `src/components/inspector/NodeInspector.tsx`
- `src/components/inspector/EventDetail.tsx`
- `src/store/uiStore.ts`

### Files modified

- `src/components/simulation/NodeGlyph.tsx` — click sets
  `uiStore.selectedNodeId`
- `src/components/simulation/PacketDot.tsx` — click sets a selected
  message id
- `src/app/modules/[moduleId]/page.tsx` — mounts the real inspector in
  the right region

### Testing strategy

- Unit test: selecting a node id in `uiStore` and reading the
  corresponding node from `simulationStore.snapshot` yields the
  expected fields.
- Manual: click each node, confirm inspector updates; click a
  mid-flight packet, confirm its detail (sender/recipient/ticks) is
  correct and matches the timeline.

### Demo checklist

- [ ] Clicking a node shows its state in the right panel
- [ ] Clicking a packet shows its send/delivery tick and payload
- [ ] Empty state shown when nothing is selected
- [ ] Selection survives a timeline seek (still points at the same
      node/message id, now showing its state at the new tick)

### Future considerations (do not implement yet)

- Module-specific state renderers (e.g. Raft's term/log view) —
  deferred until Module 7 exists; for now the inspector shows generic
  node/message fields only, since that's all any module has yet.

---

## Milestone 8 — Playback controls (play/pause/step/speed)

### Goal

Replace the temporary "Advance Tick" button with the real playback
control set from [03-design-system.md](./03-design-system.md): play,
pause, step forward/back, and a speed selector — proving that
play/pause/step/scrub are all "just different ways of asking the engine
for a tick," per [01-architecture.md](./01-architecture.md), with no
divergent code paths.

### Features implemented

- `PlaybackControls`: play (interval-driven auto-advance), pause, step
  forward, step back (re-derives the previous snapshot from the log,
  does not "undo" — consistent with the append-only log), speed
  selector (0.5x/1x/2x affecting the auto-advance interval only).
- Keyboard shortcuts: space = play/pause, arrow keys = step, per the
  accessibility baseline in [03-design-system.md](./03-design-system.md).
- Removal of the Milestone 4/5 temporary buttons.

### Files created

- `src/components/controls/PlaybackControls.tsx`
- `src/components/controls/SpeedControl.tsx`
- `src/hooks/useSimulationPlayback.ts`

### Files modified

- `src/store/simulationStore.ts` — implement `play(speed)`, `pause()`,
  `step(direction)` per [05-state-management.md](./05-state-management.md)
- `src/app/modules/[moduleId]/page.tsx` — mounts real controls,
  removes debug buttons

### Testing strategy

- Unit test: `play()` advances ticks on an interval matching the speed
  factor; `pause()` halts it; `step(-1)` moves exactly one tick
  backward via log replay.
- Manual: play at each speed, confirm packet travel animation duration
  visibly scales with speed (per
  [06-animation-system.md](./06-animation-system.md)); confirm
  space/arrow keys work; confirm step-back after play/pause lands on
  the correct prior state.

### Demo checklist

- [ ] Play animates packets continuously until paused
- [ ] Pause halts exactly where expected, resumable
- [ ] Step forward/back move exactly one tick, matching the timeline
- [ ] Speed selector visibly changes animation pace
- [ ] Keyboard shortcuts work

### Future considerations (do not implement yet)

- "Play from tick A to B" range replay (noted in Milestone 6) — add
  only if a concrete lesson/challenge needs it.
- Auto-pause on interesting events (e.g. pause on leader election) —
  a Module 7+ concern, not applicable yet.

---

## Milestone 9 — Fault injection (kill node, drop message)

### Goal

The first fault-injection commands — kill a node, drop a specific
in-flight message — implemented as NetworkModel/engine-level primitives
per [04-simulation-engine.md](./04-simulation-engine.md), proving faults
are engine features every module gets for free, not per-module
hacks. Node crashed/healthy visual states (deferred since Milestone 2)
become real for the first time here, because now there's an engine
event that can truthfully justify them.

### Features implemented

- `KILL_NODE` command: sets node status to `crashed`; the networking
  module's behaviors stop delivering timers to it (none exist yet
  beyond ping, but the status flag is real and general).
- `DROP_MESSAGE` command (or click-to-drop on a selected in-flight
  packet): marks a specific message `dropped` instead of `delivered`.
- `NodeGlyph` crashed visual (desaturated + dashed border, per
  [03-design-system.md](./03-design-system.md)); `PacketDot` drop visual
  (fade + "×").
- Minimal `FaultInjectionMenu` in the controls region exposing these
  two actions against a selected node/message.

### Files created

- `src/components/controls/FaultInjectionMenu.tsx`

### Files modified

- `src/simulation/network/NetworkModel.ts` — node status, message drop
  handling
- `src/modules/networking/` — reducer handles `KILL_NODE`/`DROP_MESSAGE`
  commands and the resulting events
- `src/components/simulation/NodeGlyph.tsx`,
  `src/components/simulation/PacketDot.tsx` — new visual states
- `src/hooks/useEventAnimations.ts` — new mapping entries
  (`NODE_CRASHED` → statusChange, `MESSAGE_DROPPED` → fade-out)

### Testing strategy

- Unit tests: killing an already-crashed node is rejected (not a new
  event); dropping a message changes its lifecycle and it never reaches
  `MESSAGE_DELIVERED`; an in-flight message sent _before_ its
  destination node crashes still resolves per the documented rule in
  [04-simulation-engine.md](./04-simulation-engine.md) (arrives at a
  dead node and is dropped).
- Manual: kill Node B mid-ping, confirm the in-flight packet's fate is
  visibly correct; drop a message manually, confirm the "×" animation
  and that the destination truthfully never received it (check
  inspector).

### Demo checklist

- [ ] Killing a node changes its glyph to the crashed visual instantly
- [ ] A message sent to an already-dead node is visibly dropped, not
      delivered
- [ ] Manually dropping an in-flight message shows the fade/× animation
- [ ] Fault commands appear in the timeline as real events

### Future considerations (do not implement yet)

- Network partitions (group-based link cutting) and delay/reorder/
  duplicate faults — the doc-specified fuller fault set from
  [04-simulation-engine.md](./04-simulation-engine.md); add once Module
  1's full content pass (Milestone 13) needs them.
- Node recovery ("un-kill") — add when a lesson actually needs to
  demonstrate rejoining.

---

## Milestone 10 — Learning panel + module routing

### Goal

The left panel shows real explanation content instead of a placeholder,
and the app supports more than one module route
(`/modules/networking`, with `/modules/introduction` as a stub) via a
`moduleRegistry`, per [05-state-management.md](./05-state-management.md)
and [08-module-roadmap.md](./08-module-roadmap.md). This is the first
milestone that treats "module" as a real navigable concept rather than
one hardcoded page.

### Features implemented

- `moduleRegistry`: static config listing available modules (id, title,
  which `SimulationModule` to construct, initial node/link config).
- `ExplanationPane`: renders static MDX/markdown content for the active
  module in the left panel.
- A simple module picker (landing page `src/app/page.tsx` lists
  available modules and links to their routes).

### Files created

- `src/store/moduleRegistry.ts`
- `src/components/learning/ExplanationPane.tsx`
- `src/app/modules/networking/content/explanation.mdx` (or `.md`)
- `src/app/modules/introduction/` (minimal stub page/content)

### Files modified

- `src/app/page.tsx` — real module picker instead of a redirect
- `src/app/modules/[moduleId]/page.tsx` — reads `moduleRegistry` to
  construct the correct engine/module and load the correct explanation
  content instead of hardcoding the networking module

### Testing strategy

- Unit test: `moduleRegistry` lookup by id returns the expected config;
  an unknown module id is handled (404 or redirect, not a crash).
- Manual: navigate between the networking module and the introduction
  stub, confirm each loads its own explanation text and its own
  simulation config independently.

### Demo checklist

- [ ] Landing page lists at least two modules
- [ ] Navigating to each shows distinct explanation content
- [ ] Simulation state does not leak between module routes (switching
      modules gives a fresh engine instance)

### Future considerations (do not implement yet)

- Full MDX component embedding (interactive widgets inside explanation
  text) — plain static content is sufficient until a lesson needs more.
- Progress tracking across modules — no gamification/progress-gating
  per [07-learning-philosophy.md](./07-learning-philosophy.md); skip
  entirely unless explicitly requested.

---

## Milestone 11 — Guided interaction steps

### Goal

The learning panel can present a scripted guided step (per
[07-learning-philosophy.md](./07-learning-philosophy.md)): an
instruction, an expected command, and an observation prompt — the first
real content-as-data authoring path.

### Features implemented

- `guided.ts` content shape: an ordered list of steps, each with
  instruction text, the command(s) that satisfy it, and a follow-up
  observation question.
- `GuidedStep` component: shows current step's instruction; advances to
  the next step once the store reports the expected command was
  dispatched (observed via the event log, not by intercepting the
  button click itself — keeps grading honest per the architecture).
- Manual "next step" fallback if a step doesn't require a specific
  action (e.g. purely observational steps).

### Files created

- `src/app/modules/networking/content/guided.ts`
- `src/components/learning/GuidedStep.tsx`

### Files modified

- `src/components/learning/ExplanationPane.tsx` (or the module page) —
  mounts `GuidedStep` below/alongside the static explanation

### Testing strategy

- Unit test: given a scripted step and a mock event log, the "step
  satisfied" check correctly identifies matching vs. non-matching event
  sequences.
- Manual: walk through the networking module's guided steps end to end,
  confirm each advances only once the actual expected simulation event
  occurs (e.g. not just on a button hover).

### Demo checklist

- [ ] First guided step shows an instruction
- [ ] Performing the expected action advances to the next step
- [ ] Performing an unrelated action does not falsely advance
- [ ] All authored steps for the networking module are reachable in
      order

### Future considerations (do not implement yet)

- Branching guided paths (different next-step depending on what the
  learner did) — linear steps are sufficient until a lesson concretely
  needs branching.
- Authoring UI/CMS for content — content stays hand-written TS/data
  files for the foreseeable future.

---

## Milestone 12 — Quiz / challenge checking

### Goal

A minimal predictive quiz and one manipulation challenge (per
[07-learning-philosophy.md](./07-learning-philosophy.md)) for the
networking module, graded against real event-log facts.

### Features implemented

- `Quiz` component: a predictive question ("will the message arrive
  before tick 5?") asked before running a scripted scenario, revealed
  against the actual outcome after.
- One manipulation challenge ("cause a message to be dropped using fault
  injection") checked by scanning the event log for a `MESSAGE_DROPPED`
  event, accepting any valid path to that outcome.
- Simple pass/fail feedback UI (no gating of navigation — per
  [07-learning-philosophy.md](./07-learning-philosophy.md), this is
  feedback, not a lock).

### Files created

- `src/app/modules/networking/content/quiz.ts`
- `src/app/modules/networking/content/challenges.ts`
- `src/components/learning/Quiz.tsx`
- A small `challengeChecker` utility (pure function over an event log)

### Files modified

- `src/components/learning/ExplanationPane.tsx` (or module page) —
  mounts `Quiz`/challenge UI

### Testing strategy

- Unit tests on `challengeChecker`: a log containing the target event
  passes; a log without it fails; a log with the target event caused a
  different, unintended way still passes (since checking is by outcome,
  not by click sequence) — confirms the "any valid path" rule from
  [07-learning-philosophy.md](./07-learning-philosophy.md) actually
  holds.
- Manual: attempt the challenge via at least two different valid
  approaches, confirm both are recognized as success; attempt an
  incorrect action, confirm it's correctly recognized as not satisfying
  the challenge.

### Demo checklist

- [ ] Predictive quiz reveals the real outcome after the scenario runs
- [ ] Challenge can be completed via more than one valid sequence of
      actions
- [ ] Incorrect attempts are not falsely marked as success
- [ ] No navigation is blocked by quiz/challenge state

### Future considerations (do not implement yet)

- Scoring, history of past attempts, retry limits — no evidence yet
  this is needed; add only if requested.
- Quiz/challenge authoring for every module — only the networking
  module needs this proven out now; the same pattern repeats per
  module in Milestone 13+ as its own scoped work.

---

## Milestone 13 — Module 1 (Networking) full content pass

### Goal

Round out the Networking module to match its full scope in
[08-module-roadmap.md](./08-module-roadmap.md): multiple nodes/links,
adjustable latency, packet loss rate, and partitions — using this as
the point where the fuller `NetworkModel` fault set
(delay/drop/reorder/duplicate, partition) described in
[04-simulation-engine.md](./04-simulation-engine.md) is finally built
out, now that a real module needs all of it.

### Features implemented

- Configurable link latency and drop-rate sliders (learner-adjustable,
  visible effect on packet behavior).
- `PARTITION_NETWORK` / `HEAL_PARTITION` commands and their visual
  treatment (link styling change, cross-partition messages auto-drop).
- Message reorder/duplicate fault commands.
- Full explanation/guided/quiz/challenge content for Module 1 per the
  module-roadmap scope (this milestone is largely _content_ work layered
  on Milestone 9-12's now-proven mechanisms).

### Files created

- (Content only, mostly) additional guided steps, quiz questions,
  challenges for networking; a `PartitionOverlay` visual component if
  needed for rendering partition groupings on the canvas

### Files modified

- `src/simulation/network/NetworkModel.ts` — partition groups,
  reorder/duplicate handling
- `src/components/controls/FaultInjectionMenu.tsx` — new fault types
- `src/app/modules/networking/content/*` — expanded content

### Testing strategy

- Unit tests per new fault type (partition blocks cross-group delivery;
  healing restores it; reorder changes delivery order without changing
  delivery count; duplicate produces exactly one extra delivery).
- Manual: full walkthrough of the module end to end as a learner would
  experience it — watch → guided → sandbox → challenge → quiz.

### Demo checklist

- [ ] Latency/drop-rate sliders visibly affect simulation behavior
- [ ] Partition/heal works and is visually distinct from a plain drop
- [ ] Reorder/duplicate faults behave correctly and are inspectable in
      the timeline
- [ ] Full Module 1 learner flow completes without dead ends

### Future considerations (do not implement yet)

- Modules 2-9 — each gets its own future milestone series, following
  this same pattern (engine/module work → content pass), scoped and
  approved individually when the time comes.
- Sandbox-mode-specific UI polish beyond reusing existing controls —
  only if the reused controls prove insufficient in practice.

---

## Milestone 14 — Polish pass: empty states, reduced motion, accessibility

### Goal

A dedicated hardening milestone before considering v1 "done": handle
edge cases and accessibility commitments made in
[03-design-system.md](./03-design-system.md)/
[06-animation-system.md](./06-animation-system.md) that were deferred
during feature-focused milestones.

### Features implemented

- `prefers-reduced-motion` handling across all animation primitives
  (instant state changes instead of tweened motion).
- Empty/loading states for inspector, timeline, and learning panel
  where not yet handled.
- Colorblind-safe status differentiation check (shape/badge alongside
  color, per the design system's accessibility baseline).
- Full keyboard operability audit of all controls added since
  Milestone 8.

### Files created

- None expected (this is a modification pass).

### Files modified

- Touches across `src/components/**` and `src/hooks/useEventAnimations.ts`
  as needed per audit findings.

### Testing strategy

- Manual audit against the accessibility baseline checklist in
  [03-design-system.md](./03-design-system.md), item by item.
- Manual test with OS-level "reduce motion" enabled, confirm all
  animated primitives degrade correctly per
  [06-animation-system.md](./06-animation-system.md).

### Demo checklist

- [ ] Reduced motion setting produces instant, still-legible state
      changes
- [ ] Every interactive control is reachable and operable via keyboard
      alone
- [ ] No status is communicated by color alone anywhere in the app
- [ ] No blank/broken states when nothing is selected/no events exist
      yet

### Future considerations (do not implement yet)

- Automated accessibility testing (axe-core, etc.) — worth adding once
  there's enough surface area to justify the tooling investment; not
  blocking for this pass.

---

## What comes after Milestone 14

Modules 2 through 9 (Replication, Consistency, CAP, Quorum, Leader
Election, Raft, Fault Injection deep-dive, Distributed Database) each
follow the same two-phase pattern established here: build the module's
engine/reducer/animation-mapping pieces first (reusing
Milestone 3/5/9's now-generalized engine, network model, and fault
primitives wherever possible), then a content pass matching
Milestone 13's shape. Each will be scoped into its own milestone series
and approved individually when reached — not pre-planned in bulk now,
consistent with the project's YAGNI stance and standing development
process.

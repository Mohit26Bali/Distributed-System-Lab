# 02 — Folder Structure

This structure exists to make the boundary described in
[01-architecture.md](./01-architecture.md) — simulation layer vs. bridge
layer vs. UI layer — physically visible and enforceable, not just a
convention people are trusted to remember.

```
distributed-systems-lab/
├── docs/                          # This documentation set
│
├── src/
│   ├── app/                       # Next.js App Router: routes only
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Landing / module picker
│   │   └── modules/
│   │       └── [moduleId]/
│   │           └── page.tsx        # Thin: composes the 3-panel layout
│   │
│   ├── components/
│   │   ├── simulation/            # Canvas-facing: nodes, links, packets
│   │   │   ├── NodeGlyph.tsx
│   │   │   ├── LinkLine.tsx
│   │   │   ├── PacketDot.tsx
│   │   │   └── SimulationCanvas.tsx
│   │   ├── inspector/             # Right panel: state/event detail views
│   │   │   ├── NodeInspector.tsx
│   │   │   ├── EventDetail.tsx
│   │   │   └── ModuleStateView.tsx
│   │   ├── timeline/              # Bottom panel: scrubbable event log
│   │   │   ├── Timeline.tsx
│   │   │   ├── TimelineTick.tsx
│   │   │   └── EventMarker.tsx
│   │   ├── controls/              # Bottom panel: play/pause/step/faults
│   │   │   ├── PlaybackControls.tsx
│   │   │   ├── SpeedControl.tsx
│   │   │   └── FaultInjectionMenu.tsx
│   │   ├── learning/               # Left panel: explanation/guided/quiz
│   │   │   ├── ExplanationPane.tsx
│   │   │   ├── GuidedStep.tsx
│   │   │   └── Quiz.tsx
│   │   └── ui/                    # shadcn/ui primitives (generated + wrapped)
│   │
│   ├── simulation/                 # ⚠ No React/Zustand imports, ever.
│   │   ├── engine/                # Generic scheduler, tick loop, event log
│   │   │   ├── Engine.ts
│   │   │   ├── Scheduler.ts
│   │   │   ├── EventLog.ts
│   │   │   └── types.ts
│   │   ├── network/               # Link/latency/partition/packet-loss model
│   │   │   ├── NetworkModel.ts
│   │   │   └── types.ts
│   │   ├── events/                # Event type definitions + factories
│   │   │   ├── networkEvents.ts
│   │   │   ├── nodeEvents.ts
│   │   │   └── index.ts
│   │   ├── models/                 # Core domain types: Node, Cluster, Message
│   │   │   ├── Node.ts
│   │   │   ├── Cluster.ts
│   │   │   └── Message.ts
│   │   └── scheduler/              # Seeded PRNG, timers, deterministic queue
│   │       ├── SeededRandom.ts
│   │       └── TimerQueue.ts
│   │
│   ├── modules/                     # One folder per learning module's *logic*
│   │   ├── networking/
│   │   ├── replication/
│   │   ├── cap/
│   │   ├── quorum/
│   │   ├── election/
│   │   └── raft/
│   │       ├── raftReducer.ts
│   │       ├── raftBehaviors.ts     # per-node message/timer handlers
│   │       ├── raftState.ts
│   │       └── raftEvents.ts
│   │
│   ├── hooks/                       # React hooks bridging store ↔ components
│   │   ├── useSimulationPlayback.ts
│   │   ├── useSelectedNode.ts
│   │   └── useEventTimeline.ts
│   │
│   ├── store/                       # Zustand: the ONLY bridge layer
│   │   ├── simulationStore.ts       # Mirrors engine snapshot + event log
│   │   ├── uiStore.ts               # Pure UI state: panel sizes, selection
│   │   └── moduleRegistry.ts        # Which module is active, its config
│   │
│   └── lib/                         # Cross-cutting utilities, no logic
│       ├── colors.ts
│       ├── format.ts
│       └── cn.ts
│
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## Rules this structure implies

- **`src/simulation/**` and `src/modules/**` may not import from `react`,
  `zustand`, `framer-motion`, or `src/components`.** These are plain
  TypeScript. This is checked by an ESLint `no-restricted-imports` rule
  scoped to those paths, not just documented — see
  [04-simulation-engine.md](./04-simulation-engine.md).
- **`src/components/**` may not import simulation internals directly.**
  Components read from `src/store` and call actions exposed by
  `src/store`/`src/hooks`. This keeps "what the engine looks like
  internally" free to change without breaking every component.
- **A learning module (`src/modules/raft`) is logic only.** The UI copy,
  guided-step scripts, and quiz content for "Module 7: Raft" live
  alongside the route in `src/app/modules/raft/` (or a content folder —
  see [08-module-roadmap.md](./08-module-roadmap.md) for how content vs.
  logic is split), not inside `src/modules/raft`. This mirrors the
  vision-doc split between "the simulation" and "the teaching wrapper
  around it": the same Raft engine module could, in principle, be reused
  by a different lesson with different framing text.
- **`src/store` is intentionally the only file group allowed to import
  from both worlds** (it imports engine types from `src/simulation` and
  is imported by React code). It is the seam, and it's kept as thin as
  possible — see [05-state-management.md](./05-state-management.md).

## Naming conventions

- Simulation/module files: verb-free nouns for state (`raftState.ts`),
  `xBehaviors.ts` for per-node message handlers, `xEvents.ts` for event
  type/factory definitions, `xReducer.ts` for the pure state-transition
  function.
- Components: PascalCase, one component per file, colocated
  `Component.tsx` (no separate `.styles.ts` — Tailwind classes live
  inline; no separate `.test.ts` colocation requirement yet — decided
  per-milestone).
- Events (`SimEvent.type` values): `SCREAMING_SNAKE_CASE`, past tense
  (`NODE_CRASHED`, not `NODE_CRASH` or `CRASH_NODE`) to reinforce that
  they describe something that already happened.

# Distributed Systems Lab

An interactive, deterministic distributed-systems simulator. Ten modules,
from a two-node network with real latency and faults up through Raft
consensus and a key-value store built entirely on top of it — every
packet, crash, and commit on screen is a real committed event, replayed
from an append-only log, never a canned animation.

## The core idea

Nothing is ever animated unless it truly happened in the simulation, and
every fault is inspectable. Every module's engine is a pure function —
`reduce(state, action, ctx) → { state, events, schedule? }` — and every
visible fact in the UI (a node's role, its term, its own store contents)
is derived purely from `(events, tick)`, never read off live engine state
directly. That single discipline is what makes the timeline genuinely
scrubbable: going back to an earlier tick re-derives the canvas exactly
as it was, rather than replaying a recording.

## Modules

In the order they're designed to be learned (see
[`docs/08-module-roadmap.md`](docs/08-module-roadmap.md)):

| # | Module | Idea |
| --- | --- | --- |
| 0 | Introduction | Orientation to the controls, timeline, and inspector — no new algorithm |
| 1 | Networking | Real per-link latency, and four distinct, explicit reasons a message can fail to arrive |
| 2 | Replication | One leader, three followers — async vs. sync is a choice between speed and durability |
| 3 | Consistency | Given replication + latency, what can a client reading the data actually observe? |
| 4 | CAP | Partition the leader away, then choose: answer anyway (stale) or refuse (unavailable) |
| 5 | Quorum | Majority (3 of 4) for both reads and writes — tolerate a dead node without picking a side |
| 6 | Leader Election (Bully) | The highest-numbered alive node always wins, discovered through messages, not assumed |
| 7 | Raft | Election + log replication + majority commit, composed into one real consensus algorithm |
| 8 | Fault Injection Deep-Dive | The same Raft engine, composing multiple faults against it at once |
| 9 | Distributed Database | A key-value store built entirely from Raft's own log — the capstone, not a new algorithm |

Every module ships with a scrubbable simulation canvas, a fault menu
(kill/partition/drop/reorder/duplicate, live latency/drop-rate config), a
per-module Theory reference dialog, guided steps, a predictive quiz, and
challenges.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
pnpm build   # production build
pnpm lint    # eslint
pnpm test    # vitest, run once (use `pnpm vitest` for watch mode)
```

## Environment variables

Copy `.env.example` to `.env.local` (already gitignored). The key is read only on the server, never exposed to the browser.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | for the AI Tutor | Groq key, used only by `/api/ai/explain` (model `openai/gpt-oss-120b`) |
| `GROQ_MODEL` | no | Override the model |
| `EXPLAIN_RATE_PER_MIN`, `EXPLAIN_GLOBAL_PER_MIN` | no | Per-visitor and global request limits |
| `TRUSTED_PROXY_HOPS` | no | Reverse proxies in front of the app (Vercel: 1), so the limiter keys on the real client address |

Without a key the "Explain this tick" button shows an explicit "GROQ_API_KEY is not set" message. Nothing else depends on it.

## Project structure

```text
src/
├── simulation/          ← framework-agnostic engine core — zero React imports
├── modules/<id>/         ← one folder per module: constants, events, state, reducer, behaviors
├── store/                 ← moduleRegistry (topology + content), simulationStore, uiStore,
│                             and per-module guided-step/quiz/challenge content
├── components/
│   ├── simulation/          ← SimulationCanvas, NodeGlyph (the one shared node primitive), LinkLine
│   ├── controls/             ← per-module manual-trigger controls, FaultInjectionMenu
│   ├── inspector/              ← InspectorPanel, NodeInspector, EventDetail
│   ├── learning/                 ← ExplanationPane, GuidedStep, Quiz, Challenge
│   ├── theory/                    ← TheoryDialog/TheorySection + one <Module>Theory.tsx per module
│   ├── ai/                          ← ExplainThisTick
│   └── home/                          ← landing page components
├── hooks/                ← derive-from-events hooks, every one shaped (events, id, tick) → value
├── lib/ai/               ← the AI Tutor's scoped prompt builder
└── app/                  ← landing page, the shared module page route, the AI Tutor's API route
```

See [`docs/`](docs/) for every module's design doc and milestone
breakdown — each module was built one milestone at a time (design doc →
implementation → tests → guided content), not all at once.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Zustand · React Flow · Tailwind CSS v4 · Radix UI · Framer Motion · Groq

## Quality, security and design

- **AI route hardening** - `/api/ai/explain` checks same-origin, content type and body size, validates and caps every field (`src/lib/ai/explain-guard.ts`), rate-limits per visitor, caps the model's output and never forwards provider error text to the browser.
- **Security headers** - CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, Referrer-Policy and Permissions-Policy (`next.config.ts`).
- **Dependencies** - `pnpm audit` reports no known vulnerabilities. The `shadcn` CLI is not a dependency; run it with `pnpm dlx shadcn` when needed. Use pnpm 11 (`pnpm@11.15.0`) to match the lockfile.
- **Oscilloscope theme** - phosphor-green on near-black, a ten-division graticule, faint CRT scan lines and readout-style labels. The Tailwind colour names are re-pointed in `src/app/globals.css` (sky = phosphor green, cyan family = secondary trace, purple family = magenta, amber family = amber, red = fault), so existing classes follow the theme. The home hero is a photo carousel (one still photo with reduced motion); photographers are credited in the footer.
- **Small screens** - module pages stack the canvas, the explanation panel and the inspector, with the timeline pinned to the bottom.

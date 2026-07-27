# 03 — Design System

## Reference points

Visually, this should feel closer to a **dev tool** (think: a debugger,
a network inspector, a waveform viewer) than a course platform. Dark by
default, information-dense but uncluttered, motion used to communicate
state changes rather than to decorate.

## Layout

Four regions, always visible together on desktop (a module is never
"read" without the simulation present):

```
┌────────────┬───────────────────────────────┬──────────────┐
│            │                                │              │
│  Learning  │      Simulation Canvas         │  Inspector   │
│  Panel     │      (React Flow-based)        │              │
│  (left)    │      (center)                  │  (right)     │
│            │                                │              │
│  ~280px    │          flexible              │   ~320px     │
│  collapsib.│                                │  collapsible │
├────────────┴───────────────────────────────┴──────────────┤
│  Timeline + Playback Controls  (bottom, ~120px, fixed)      │
└──────────────────────────────────────────────────────────┘
```

- Left and right panels are collapsible (icon-rail state) so the canvas
  can go full-width for demos/screenshots.
- Bottom timeline bar is never collapsed — playback state must always be
  visible, since "what tick am I on" is the platform's core orientation
  device.
- Below a breakpoint (tablet/mobile), panels stack: canvas on top,
  learning/inspector become tabs, timeline stays pinned to the bottom.
  Full parity on mobile is a non-goal for v1 — see
  [08-module-roadmap.md](./08-module-roadmap.md).

## Color system

Dark theme is the default and primary target; a light theme is not
planned for v1.

Base palette (Tailwind CSS variables, defined once in `globals.css`,
consumed via Tailwind config — no literal hex in components):

| Token | Purpose |
|---|---|
| `--bg-canvas` | Simulation canvas background (near-black, slightly cooler than panels to make it recede) |
| `--bg-panel` | Left/right/bottom panel background |
| `--bg-elevated` | Cards, popovers, inspector rows |
| `--border-subtle` | Panel dividers, node borders at rest |
| `--text-primary` / `--text-secondary` / `--text-muted` | Content hierarchy |
| `--accent` | Primary interactive accent (selection, active playback) |

**Semantic simulation colors** (the important part — these are not
"brand" colors, they are a fixed vocabulary the learner comes to read at
a glance, consistent across every module):

| Meaning | Color role | Example use |
|---|---|---|
| Healthy / alive node | neutral/blue | default node fill |
| Leader / primary role | gold/amber | Raft leader, primary in replication |
| Follower / secondary role | blue | Raft follower, replica |
| Candidate / in-progress role | purple | Raft candidate during election |
| Crashed / partitioned node | red, desaturated + dashed border | node down or unreachable |
| In-flight message (normal) | accent blue, small dot | packet traveling a link |
| In-flight message (write/replication) | green | data-carrying packet |
| In-flight message (vote/control) | purple | election/heartbeat traffic |
| Dropped / lost message | red, fades out with an "×" | fault-injected drop |
| Delayed message | amber, trailing ghost | fault-injected latency |

This table is the actual design contract: a new module must reuse these
meanings rather than invent new colors for "a node that's down" or "a
write in flight." Consistency here is what lets a learner transfer
intuition from Module 2 (Replication) to Module 7 (Raft) without
re-learning the visual language.

## Typography

- UI chrome (panels, labels, buttons): the default Tailwind/system sans
  stack — kept plain so it doesn't compete with the canvas.
  content, log payloads, term/index numbers): a monospace font
  (e.g. Geist Mono / JetBrains Mono), because these values are read
  precisely, not skimmed.
- Explanation prose (left panel): slightly larger line-height, capped
  measure (~65ch) for readability — this is the one place in the UI that
  is read like an article.

## Components

- **shadcn/ui** supplies primitives (Button, Dialog, Tabs, Tooltip,
  Slider, Popover, Sheet) — used as-is for chrome (menus, dialogs,
  forms), never restyled into simulation-canvas elements. The canvas's
  visual language (node glyphs, links, packets) is bespoke, built on
  React Flow's node/edge rendering, not shadcn components.
- **Lucide icons** for all iconography, at a single consistent stroke
  width. Icon meaning is also part of the shared vocabulary (e.g. the
  same "crash" icon glyph is used for a dead node badge in the canvas,
  in the inspector, and in the fault-injection menu).
- Every interactive control that affects the simulation (kill node, add
  delay, partition network) uses the same visual "fault" affordance: a
  small warning-colored icon button, grouped in the Fault Injection menu
  in the controls panel — so learners build a habit of "faults live
  here," rather than fault controls being scattered ad hoc per module.

## Motion (summary — full spec in 06-animation-system.md)

- Motion communicates *state transition*, not decoration. A node doesn't
  "pulse for attention," it pulses because an event marked it as, e.g.,
  newly elected leader.
- Timing: fast enough to feel responsive at 1x playback (~200-400ms per
  discrete transition), but every transition is also fully scrubbable —
  motion is never the only way to perceive a state change; the inspector
  always shows the same information at rest.
- Framer Motion `layout` animations handle node/edge repositioning;
  explicit `animate` props driven by event data handle packet travel,
  color/role transitions, and crash/recovery states.

## Accessibility baseline

- Color is never the only signal: role and status also get a shape/badge
  (leader gets a crown glyph, crashed gets a dashed border + slash icon)
  so the palette isn't load-bearing for colorblind users.
- All playback controls are keyboard-operable (space = play/pause, arrow
  keys = step); this doubles as the "power user" interaction model, not
  just an accessibility add-on.
- Respect `prefers-reduced-motion`: state transitions still occur
  instantly (a crashed node still turns red), but movement/easing is
  cut down to opacity/color changes rather than position tweening.

# 06 — Animation System

## The one rule everything else follows

> Animation renders the diff between two consecutive committed
> snapshots, driven by the event that produced that diff. Nothing is
> ever animated speculatively, optimistically, or for decoration.

Concretely: a component never calls `animate()` because of a user
action. It calls it because the store's `snapshot`/`events` changed, and
the *shape* of the animation (does a dot move, does a node change color,
does something fade out) is looked up from the event's `type`, not
improvised per interaction.

## Event → animation mapping

Each module defines a small, explicit table mapping its event types to
animation primitives. This table is data, not scattered `if` statements
in components:

```ts
// src/modules/raft/raftAnimations.ts (illustrative)
export const raftAnimationMap: EventAnimationMap = {
  VOTE_REQUESTED:  { kind: 'packet', color: 'control', from: 'sender', to: 'recipient' },
  VOTE_GRANTED:    { kind: 'packet', color: 'control', from: 'sender', to: 'recipient' },
  LEADER_ELECTED:  { kind: 'roleChange', role: 'leader', glyph: 'crown' },
  NODE_CRASHED:    { kind: 'statusChange', status: 'crashed' },
  LOG_REPLICATED:  { kind: 'packet', color: 'write', from: 'sender', to: 'recipient' },
};
```

Generic engine-level events (`NODE_CRASHED`, `MESSAGE_DROPPED`,
`PARTITION_STARTED`) have one shared mapping used by every module, so a
crash always looks like a crash regardless of which lesson you're in —
this is the animation-layer expression of the shared visual vocabulary
in [03-design-system.md](./03-design-system.md).

## Primitives

- **`packet`** — a `PacketDot` component animates along the `LinkLine`
  between two nodes over the message's actual simulated transit time
  (scaled by playback speed), not a fixed decorative duration. If the
  network model says this message takes 3 ticks to arrive and we're
  playing at 1x with N ms/tick, the dot's travel animation takes `3*N`
  ms. This is what makes "this message is delayed" *visible* rather than
  just inferable from a number in the inspector.
- **`roleChange`** — a `NodeGlyph` cross-fades/morphs its badge and
  border treatment (e.g. follower → candidate → leader), using Framer
  Motion's `layout` + `AnimatePresence` for the badge swap.
- **`statusChange`** — crash/recover/partition visual states (desaturate
  + dashed border animating in; the reverse on recovery/heal).
  Immediate color change plus a brief "impact" pulse so it reads clearly
  even mid-scrub.
- **`highlight`** — a transient emphasis (e.g. briefly ring-highlighting
  a node whose term just changed) for events that matter but don't
  change persistent visual state.

Adding a new module never requires touching the animation *primitives* —
only adding entries to that module's event→animation table. If a new
kind of visual effect is genuinely needed, it's added as a new primitive
type here, reviewed for reuse across modules, not created ad hoc inside
one module's components.

## Driven by Framer Motion, orchestrated by event diffing

- Node position/size changes (topology changes, panel resize causing
  canvas relayout) use Framer Motion `layout` animations — free
  smoothing for anything React Flow repositions.
- Event-driven effects (packet travel, status/role changes) use explicit
  `animate` props/`useAnimate` keyed off a `key` derived from the event
  id, so React treats each event's animation as its own instance and
  won't merge/skip when events arrive in quick succession.
- A single `useEventAnimations(events: SimEvent[])` hook (in
  `src/hooks`) is the seam: it takes newly-committed events since last
  render, looks each up in the active module's animation map, and
  returns a list of "effects to run," which `SimulationCanvas` and
  friends consume. Components don't independently decide "did something
  change," they consume this hook's output.

## Playback speed and scrubbing interact correctly by construction

Because animation duration is derived from simulated transit
time × a speed factor (not a fixed CSS duration), and because scrubbing
just re-renders at a different tick with no animation at all (jumping
directly to the target snapshot, per
[05-state-management.md](./05-state-management.md)'s `seek`), the two
interaction modes never fight each other:

- **Play at 1x/2x/0.5x**: animations run, scaled by speed factor.
- **Step one tick**: the single tick's events animate once, then stop
  (a "preview" of one discrete transition, useful for careful study).
- **Scrub/seek**: no animation — snap directly to the target snapshot.
  (Rationale: scrubbing rapidly across many ticks at animation speed
  would be strictly worse for inspection than an instant, correct
  snapshot; if a "replay this range" affordance is wanted later, it's
  implemented as "play from tick A to tick B," reusing the play path,
  not as animated scrubbing.)

## Respecting `prefers-reduced-motion`

Per [03-design-system.md](./03-design-system.md): when reduced motion is
requested, `packet` animations become instant appear/disappear at
source/destination (no tweened travel), and `roleChange`/`statusChange`
skip position/scale tweening but keep the color/badge change and the
brief highlight pulse — state changes must still be perceivable, just
without motion.

## Testing strategy

- Animation *mapping* tables are plain data — testable with a simple
  assertion that every event type a module can emit has an entry (a
  lint-like test failing loudly if a new event type is added to a module
  without a corresponding animation entry).
- Visual animation behavior itself is verified manually per milestone
  (see each milestone's "testing strategy" step in the development
  process) rather than through pixel-diff snapshot tests, which are
  high-maintenance for continuous motion; instead, the *data* driving
  animation (which events fired, in what order) is what's covered by
  the simulation engine's own test suite.

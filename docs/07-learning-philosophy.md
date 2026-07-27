# 07 — Learning Philosophy

## Why simulation beats prose for this subject

Distributed systems concepts are hard to teach in text for a specific,
structural reason: the core difficulty isn't the vocabulary (quorum,
term, leader), it's building an intuition for **concurrency and
causality** — multiple things happening "at once," in an order that
isn't fixed in advance, where the same algorithm can produce different
observable traces depending on timing. Prose is sequential; the subject
matter isn't. A sequence diagram is a single frozen trace someone
already chose for you — it teaches "an example," not "the space of what
could happen."

A simulation the learner can run, re-run with different faults, and
scrub through lets them build a mental model of the *space* of behaviors
an algorithm permits, not just one example of it. That's the actual
justification for choosing this format over an article or video series.

## The five-stage loop, in more depth

(Introduced in [00-vision.md](./00-vision.md); this doc covers *why*
each stage exists and what would break without it.)

### 1. Watch

A short, automatic, correct run of the concept, narrated by inline
annotations tied to the timeline (not a voiceover — text callouts pinned
to specific ticks/events). Purpose: give the learner a correct reference
trace *before* asking them to predict or manipulate anything. Skipping
this and going straight to "now you try" is a common failure mode of
interactive tools — it asks learners to experiment with a system whose
correct behavior they haven't yet seen even once, so their hypotheses
have nothing to be tested against.

### 2. Interact

The learner is given the same controls as "Watch" (play/pause/step) plus
manual configuration (change node count, change network latency) and a
**specific, falsifiable question** — never an open-ended "explore!"
prompt. Open-ended sandboxes are valuable (stage 3 and the dedicated
sandbox mode), but as a *second* stage they tend to produce aimless
clicking rather than learning, because the learner doesn't yet know what
to look for. A concrete question ("will node C have the write before or
after the leader crashes?") gives the exploration a hypothesis to
confirm or refute.

### 3. Break it

Fault injection is where the actual "aha" moments live, because failure
behavior is precisely the part textbooks assert rather than show ("a
majority partition can make progress" is a sentence; watching it happen
after you personally chose which three nodes to kill is a different kind
of knowing). This stage is deliberately *not* gated behind "advanced
mode" — it's core to every module from the start, per
[00-vision.md](./00-vision.md), because otherwise the platform teaches
the happy path only, which is the same failure mode as the textbooks
it's trying to improve on.

### 4. Reflect

The inspector and timeline let the learner go backward and ask "what
exactly happened, and in what order, and why" at the level of individual
events — this is the stage that turns "I watched something surprising
happen" into "I can now explain why it happened," which is the actual
target, not just spectacle. Concretely this means: every surprising
outcome in stage 2/3 must be traceable, via the timeline, to the specific
events that caused it, in the learner's own time, without needing to
re-run anything.

### 5. Be tested

A quiz/challenge with a checkable answer (see "Challenges" below) closes
the loop. Without this stage, "I watched a cool animation" can be
mistaken for "I understood the concept" — the test is what forces the
gap (if any) to surface, ideally while the learner still has the
simulation in front of them to go check.

## Guided interaction design

Guided steps (stage 2) are authored as small scripts, not free text:
a guided step specifies a starting config, an instruction, an expected
learner action (or a small set of acceptable actions), and a specific
thing to observe afterward. This is content, not code — it lives
alongside each module's route (see
[02-folder-structure.md](./02-folder-structure.md) and
[08-module-roadmap.md](./08-module-roadmap.md)) as data describing
"which commands are being asked for and what question they answer," so
non-engineers (or future contributors) can author/edit lesson content
without touching simulation code.

## Sandbox mode

Every module also exposes an unconstrained sandbox: same simulation,
same controls, no scripted question, no "correct" outcome to check
against — full manual control over topology, node count, and fault
injection. This exists for learners who've been through stages 1-5 and
want to test their own hypotheses ("what if I do this weird thing the
lesson never asked about"), and for instructors driving live demos. The
sandbox reuses the exact same engine/module/animation stack as guided
mode — it's a different UI composition (no learning panel script, no
quiz), not a different simulation.

## Challenges and quizzes: what "checkable" means here

Two flavors, deliberately distinct:

- **Predictive quiz** — asked *before* running a specific scenario
  ("Node 2 will become leader. True or false?"), then the learner runs
  it and sees the actual outcome. This tests whether their model
  predicts correctly, which is a stronger signal than a quiz asked in
  isolation with no simulation attached.
- **Manipulation challenge** — a goal stated in terms of the simulation
  itself ("cause a split-brain scenario using fault injection," "force a
  new leader election without killing the current leader"). Checked by
  inspecting the resulting event log for the target condition (e.g.
  "two `LEADER_ELECTED` events for the same term" for split-brain),
  not by matching a specific sequence of clicks — there is often more
  than one valid path to the target condition, and the checker must
  accept any of them.

Both flavors are checked against **engine event-log facts**, never
against UI interaction sequences — this keeps challenges honest with the
"simulation first" architecture: what's graded is what actually happened
in the simulation, the same ground truth the learner is inspecting.

## What the platform deliberately does not do

- No pass/fail gating that blocks progress to later modules — modules
  build conceptually on each other (see
  [08-module-roadmap.md](./08-module-roadmap.md)) but a learner is
  trusted to judge their own readiness, consistent with an audience that
  already knows how to code and is motivated by curiosity, not
  compliance.
- No leaderboard/gamification layer. Motivation here comes from the
  simulation itself being satisfying to play with, not from points.
- No assumption that a learner reads every explanation in order top to
  bottom before touching the simulation — the simulation must be
  legible and inviting to poke at immediately, with explanation
  available alongside, not gating access to it.

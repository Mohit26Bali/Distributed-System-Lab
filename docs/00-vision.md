# 00 — Vision

## What this is

**Distributed Systems Lab** is an interactive platform for learning distributed
systems by watching them run, breaking them, and fixing them — not by reading
about them.

Think of the category we're in: CPU simulators (like Ben Eater's breadboard
computer, or Ruffle's 6502 visualizers) and physics simulators (like
PhET). Nobody learns how a CPU fetches an instruction by reading a paragraph
about the fetch-decode-execute cycle. They learn it by watching the program
counter increment, watching a value move from RAM into a register, and then
pausing it themselves to check "wait, why did that happen?"

Distributed systems have almost none of this. The concepts (quorum, leader
election, consistency models, network partitions) are inherently about
_time_, _causality_, and _concurrency_ — three things that are nearly
impossible to build intuition for from static prose and sequence diagrams.
This project exists to close that gap.

## Who this is for

Primarily: engineers and students who already know how to code and have
read _some_ distributed systems material (a blog post, a textbook chapter,
a Raft paper abstract) but don't yet have working intuition. The audience
is not a total beginner to programming, but is very possibly a beginner
to distributed systems.

Secondarily: instructors who want a tool to demo concepts live.

## What "learning by experimentation" means here

Every module in this platform follows the same loop:

1. **Watch** — see a correct, working simulation run automatically, with
   annotations, so the shape of the concept is visible before anything is
   asked of the learner.
2. **Interact** — the learner is handed manual controls (pause, step,
   rewind, replay, inject a delay, kill a node, drop a packet) and a
   concrete question ("what happens to node C's data if you kill the
   leader right now?"). They form a hypothesis and test it.
3. **Break it** — fault injection is not an advanced/optional feature, it
   is core. Learners should be able to partition the network, kill nodes,
   delay messages, and reorder them, and see the system's real behavior
   (including its real _failure_ behavior) rather than a sanitized happy
   path.
4. **Reflect** — an inspector and event timeline let the learner scrub
   backwards through exactly what happened and why, at the level of
   individual messages and state transitions.
5. **Be tested** — a small challenge or quiz closes the loop and checks
   that the intuition actually formed.

## Design commitments

These are commitments, not aspirations — they constrain the architecture
(see [01-architecture.md](./01-architecture.md)):

- **Nothing is animated unless it happened.** If a message didn't get sent
  in the simulation, it does not get drawn moving across the screen. This
  is the difference between an "explainer animation" and a real simulator,
  and it's the reason the simulation engine has to be authoritative and
  the UI has to be a pure renderer of its output.
- **Every packet has a reason to exist.** Nothing is generated for visual
  flavor. If a dot moves from node A to node B, it's because a specific,
  inspectable event — a heartbeat, a replication write, a vote request —
  says so, and the learner can click that dot and see exactly what it is.
- **Time is a first-class, scrubbable dimension.** Pausing, stepping, and
  rewinding aren't debug features bolted on later — they are as important
  as the "play" button, because causality and ordering are the entire
  point of the subject matter.
- **The learner can always ask "why."** Every visible effect must be
  traceable to a cause the learner can inspect: which node produced
  it, which tick it happened on, and what rule of the algorithm produced
  it.

## What this is not

- Not a video course. No talking heads, no slides-with-narration.
- Not a static-diagram wiki. Diagrams are running simulations, not SVGs
  someone drew once.
- Not a production distributed-systems framework. The simulation engine
  models algorithms faithfully enough to teach correctly, but it is not
  trying to be a real Raft implementation you'd deploy — see
  [04-simulation-engine.md](./04-simulation-engine.md) for the line we
  draw there.

## Success looks like

A learner who has never fully understood _why_ quorum-based systems can
tolerate `N/2 - 1` failures can pause a 5-node cluster, kill two nodes
themselves, watch the remaining three still reach consensus, then kill a
third and watch it fail — and now they don't need to be told the formula,
because they've seen the boundary with their own hands.

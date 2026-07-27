# 08 — Module Roadmap

## Shape of a module

Every module (per [00-vision.md](./00-vision.md)/
[07-learning-philosophy.md](./07-learning-philosophy.md)) delivers the
same seven parts:

| Part | Lives in | Nature |
|---|---|---|
| Explanation | `src/app/modules/<id>/content/explanation.mdx` (or similar) | Content |
| Visual simulation | `src/simulation` + `src/modules/<id>` | Code |
| Guided interaction | `src/app/modules/<id>/content/guided.ts` | Content (data-shaped, per 07) |
| Sandbox | Composition of existing canvas/controls, module config only | Code (mostly free) |
| Inspector views | `src/components/inspector` (module-specific detail renderers) | Code |
| Challenge | `src/app/modules/<id>/content/challenges.ts` + event-log checker | Content + small code |
| Quiz | `src/app/modules/<id>/content/quiz.ts` | Content |

Explanation/guided/challenge/quiz content is deliberately kept as data
next to the route, not inside `src/modules/<id>` (the simulation logic
folder) — per [02-folder-structure.md](./02-folder-structure.md), this
keeps "how the algorithm behaves" separable from "how we teach this
particular lesson about it."

## Dependency order

Modules are ordered so each one only assumes concepts already covered.
This is a *conceptual* dependency graph, not a strict engineering build
order (engineering order is a milestone-by-milestone decision made
separately, per the top-level development process) — but it does mean
later modules reuse earlier modules' engine primitives rather than
reinventing them:

```
Module 0  Introduction
    │  (orientation to the UI/controls themselves — no new algorithm)
    ▼
Module 1  Networking
    │  (latency, links, packet loss — the substrate everything else runs on)
    ▼
Module 2  Replication
    │  (copying data leader→follower; introduces the write/replicate event kind)
    ▼
Module 3  Consistency
    │  (what "correct" even means once replication + delay exist: staleness, ordering)
    ▼
Module 4  CAP
    │  (partitions force a choice; needs Module 1's partition fault + Module 3's vocabulary)
    ▼
Module 5  Quorum
    │  (majority-based decisions as the mechanism for surviving what Module 4 poses)
    ▼
Module 6  Leader Election
    │  (how a quorum picks/replaces a coordinator — needs Module 5)
    ▼
Module 7  Raft
    │  (composes election + replication + quorum into one full algorithm)
    ▼
Module 8  Fault Injection
    │  (dedicated deep-dive: composing multiple faults, timing attacks on Module 7's Raft)
    ▼
Module 9  Distributed Database
       (capstone: a small multi-node KV store using everything above)
```

## Module summaries

### Module 0 — Introduction
Not a distributed-systems concept — an orientation to the platform
itself: what a node/link/packet glyph means, how to use play/pause/step/
scrub, where the inspector and fault menu live. Uses a trivial 2-node
"ping" simulation as the running example. Exists so every later module
can assume the learner already knows how to operate the controls, and
doesn't have to re-teach UI mechanics inside teaching content.

### Module 1 — Networking
Links, latency, packet loss, reordering, partitions — the network model
itself, with no application-level algorithm on top yet (nodes just send
each other pings/echoes). Teaches that "the network" is not a reliable
FIFO pipe, which is the assumption every later module needs the learner
to have already discarded.

### Module 2 — Replication
Leader/follower roles introduced for the first time; a write on the
leader gets copied to followers. Sync vs. async replication as a
configurable toggle, so the learner can directly compare (same write,
same fault) under both.

### Module 3 — Consistency
Given replication + real latency (Modules 1-2), what can a *client*
observe? Strong vs. eventual consistency, staleness windows, read-your-
writes — demonstrated by letting the learner read from different
replicas mid-replication and see divergent answers.

### Module 4 — CAP
Frame the partition scenario explicitly: given a network partition
(Module 1's fault), show the system choosing availability
(answer, possibly stale) or consistency (refuse to answer) as a
directly manipulable toggle, so "CAP is a choice, not a law you can
route around" is something the learner selects and observes rather than
reads as an assertion.

### Module 5 — Quorum
Majority read/write rules as the general mechanism for tolerating the
Module 4 tradeoff without simply picking one side forever. The
"kill nodes until it stops working" experience named as the target in
[00-vision.md](./00-vision.md)'s success criterion belongs here.

### Module 6 — Leader Election
How a cluster picks (and replaces) a leader using quorum votes; election
timeouts, split votes, term/epoch numbers as the mechanism preventing two
leaders from both believing they're in charge.

### Module 7 — Raft
The composite: leader election (Module 6) + log replication (Module 2) +
quorum commit (Module 5), taught as "you already know all three pieces,
here is how one real algorithm assembles them." This is the module where
the platform's animation vocabulary (role colors, packet colors for
control vs. write traffic) pays off most visibly, since every visual
element was already introduced individually in an earlier module.

### Module 8 — Fault Injection
A dedicated module (not just "the fault menu," which exists from Module
0 onward) focused on *composing* faults against Raft specifically:
partition the leader away from a majority, kill a node mid-election,
delay just the vote responses. Goal: the learner leaves confident
predicting Raft's behavior under adversarial timing, not just its happy
path.

### Module 9 — Distributed Database
Capstone: a small multi-node key-value store built from the primitives
above (Raft for consensus, quorum reads/writes, replication), with a
simple client the learner can issue reads/writes from directly and watch
the whole stack react. Less a new concept, more an integration exercise
proving the earlier modules composed into something real.

## What's explicitly out of scope for v1

Sharding/partitioned keyspaces, Byzantine fault tolerance, gossip
protocols/CRDTs, and multi-region/geo-replication are natural
follow-on modules but are not part of the initial nine — they're noted
here so a future roadmap revision has an obvious place to extend the
list rather than needing to re-derive it.

## How this roadmap relates to engineering milestones

This document describes *teaching* order and conceptual dependency, not
the order features get built. Per the top-level development process,
each engineering milestone is scoped, discussed, and confirmed
individually — the first milestones will most likely be the engine core
and Module 0/1 (since nothing else can be built or demoed without the
engine and a working canvas), not necessarily in the numeric order
implied above.

import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function FaultInjectionTheory() {
  return (
    <TheoryDialog title="Theory — Fault Injection Deep-Dive">
      <TheorySection heading="The exact same Raft engine, on purpose">
        <p>
          This module is a pure content identity over Raft&apos;s own engine — same election, same
          replication, same commit safety, zero new mechanics. The lesson isn&apos;t a new
          algorithm; it&apos;s whether you actually believe Raft&apos;s guarantees hold once faults
          start stacking on top of each other instead of arriving one at a time.
        </p>
      </TheorySection>

      <TheorySection heading="Predict before you run it">
        <p>
          The point of this module is prediction, not observation: decide what you think will
          happen — does this election succeed, does this entry commit, does this node become
          leader — before you click anything. The simulator confirming or contradicting your guess
          is the actual lesson, not the animation itself.
        </p>
      </TheorySection>

      <TheorySection heading="Composing faults, not just applying one">
        <p>
          Partition a node away right as it&apos;s about to win an election. Kill a leader the
          instant it sends AppendEntries, before any response comes back. Delay just the vote
          responses, not the vote requests. Each of these alone is easy to reason about; stacked
          together, they&apos;re where real distributed systems actually break in production.
        </p>
      </TheorySection>

      <TheorySection heading="Every fault here already existed">
        <p>
          Kill/partition/drop/reorder/duplicate aren&apos;t new to this module — they&apos;re the
          exact same actions from Networking&apos;s fault menu, now aimed at a real consensus
          algorithm instead of a bare 3-node network. Nothing about the fault mechanics changed;
          only the thing they&apos;re being pointed at did.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          The Distributed Database capstone builds a real client-facing key-value store on top of
          this exact engine — proving these primitives compose into something a client would
          actually use, not just something that survives adversarial timing in isolation.
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

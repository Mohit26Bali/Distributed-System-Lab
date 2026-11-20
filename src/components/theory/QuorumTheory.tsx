import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function QuorumTheory() {
  return (
    <TheoryDialog title="Theory — Quorum">
      <TheorySection heading="Majority, not 'all' and not 'just the leader'">
        <p>
          A quorum write behaves like a sync write, but only needs a{" "}
          <strong className="text-text-primary">majority</strong> of the whole cluster (3 of 4
          here) to confirm — not every follower. That&apos;s the fix for sync&apos;s stuck-forever
          problem: one dead follower no longer blocks every future write.
        </p>
      </TheorySection>

      <TheorySection heading="Quorum reads reconcile disagreeing replicas">
        <p>
          A quorum read gathers answers from a majority of nodes and trusts whichever one has the
          highest version — even if a genuinely stale replica&apos;s answer was one of the ones
          counted toward that majority. Version, not vote count, decides.
        </p>
      </TheorySection>

      <TheorySection heading="Why a follower asks the leader to coordinate">
        <p>
          This star topology only gives the leader direct links to everyone — followers can&apos;t
          reach each other at all. So a quorum read from a follower can&apos;t fan out itself; it
          asks the leader to run the gather on its behalf, folding the follower&apos;s own answer
          in for free before polling the rest. A real, load-bearing topology constraint, not an
          arbitrary design choice.
        </p>
      </TheorySection>

      <TheorySection heading="Kill nodes until it stops working">
        <p>
          With majority = 3 of 4: kill one node, and quorum reads/writes still work — a majority is
          still reachable. Kill a second, and both stop resolving, live, in front of you. That
          exact number — how many nodes can die before the system breaks — is the whole point,
          made concrete instead of asserted.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          Leader Election asks a question Quorum&apos;s fixed leader has been quietly skipping:
          how does a cluster <em>pick</em> its leader in the first place, and replace one that
          dies?
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function CapTheory() {
  return (
    <TheoryDialog title="Theory — CAP">
      <TheorySection heading="Zero new code, one new frame">
        <p>
          This module doesn&apos;t add a single new mechanic — it recombines two things you
          already have: Networking&apos;s partition fault, and Consistency&apos;s eventual/strong
          reads. CAP isn&apos;t a new algorithm; it&apos;s a new lens on mechanics you&apos;ve
          already used.
        </p>
      </TheorySection>

      <TheorySection heading="Partition the leader away">
        <p>
          Isolate the leader from the followers using the fault menu&apos;s Partition button.
          Nothing announces this happened — no event says &quot;you are now partitioned&quot;;
          you only see its consequences in what messages do and don&apos;t arrive.
        </p>
      </TheorySection>

      <TheorySection heading="Availability: answer anyway">
        <p>
          An eventual read from a cut-off follower still answers instantly — available, but
          frozen at whatever it knew before the partition began. That&apos;s the &quot;A&quot;
          in CAP, chosen directly, not asserted in prose.
        </p>
      </TheorySection>

      <TheorySection heading="Consistency: refuse instead">
        <p>
          A strong read from that same follower forwards to the leader and simply never comes
          back — dropped, reason <span className="font-mono text-xs text-red-400">partitioned</span>.
          The follower would rather answer nothing than answer something it can&apos;t verify.
          That&apos;s the &quot;C&quot;, and it costs you the &quot;A&quot; to get it.
        </p>
      </TheorySection>

      <TheorySection heading="Why this cluster can never split-brain">
        <p>
          There is exactly one node that can ever accept a write here, partition or not — a real
          split-brain scenario needs a system where <em>both</em> sides of a partition can decide
          they&apos;re in charge, which needs an election-capable engine (Raft), not this one.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          Quorum answers the actual question CAP poses: is a binary A-vs-C choice the only option?
          A majority-based rule tolerates a dead node without permanently picking a side.
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

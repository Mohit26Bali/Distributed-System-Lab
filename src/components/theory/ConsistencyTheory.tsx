import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function ConsistencyTheory() {
  return (
    <TheoryDialog title="Theory — Consistency">
      <TheorySection heading="Same engine as Replication, one new question: reading">
        <p>
          Nothing new was built for writes here — this module adds a{" "}
          <span className="font-mono text-xs text-green-400">READ</span> action on top of the
          exact same leader/follower store. The interesting part was never the write; it&apos;s
          what a client actually sees when it asks.
        </p>
      </TheorySection>

      <TheorySection heading="Eventual: instant, but possibly stale">
        <p>
          An eventual read answers immediately from whatever the target node&apos;s own store
          currently holds — no message, no round trip. If replication hasn&apos;t caught up to
          that node yet, you get the old value, or &quot;not found&quot; for something that
          already exists elsewhere in the cluster.
        </p>
      </TheorySection>

      <TheorySection heading="Strong: never stale, but never instant either">
        <p>
          A strong read on the leader is free — the leader&apos;s own copy is always
          authoritative. A strong read on a <strong className="text-text-primary">follower</strong>{" "}
          forwards the request to the leader and waits for the reply — a real, visible round trip
          over the network, not a free correctness guarantee. Consistency has a literal latency
          cost, and this is where you can watch it.
        </p>
      </TheorySection>

      <TheorySection heading="Read-your-writes can genuinely fail">
        <p>
          Write a value on the leader, then immediately read it back from a follower with
          Eventual — you may see the old value, or nothing at all, even though you just wrote it
          yourself. The same read done Strongly never has this problem, by construction. That gap
          is the entire lesson.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          CAP names the tradeoff you just made explicit: under a partition, do you keep answering
          (Eventual, possibly stale) or refuse (Strong, unavailable)?
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

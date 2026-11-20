import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function ReplicationTheory() {
  return (
    <TheoryDialog title="Theory — Replication">
      <TheorySection heading="One leader, three followers, fixed for the session">
        <p>
          Unlike Election/Raft, nobody votes for this leader — it&apos;s a fixed role for the whole
          run, and the topology is a star: followers only ever talk to the leader, never to each
          other. A write only ever goes to the leader; it&apos;s applied to the leader&apos;s own
          store immediately, then replicated outward over the network, with real latency and
          real faults, exactly like every message in Networking.
        </p>
      </TheorySection>

      <TheorySection heading="Async: fast, but a write can vanish">
        <p>
          Async mode acknowledges the instant the leader accepts the write —{" "}
          <span className="font-mono text-xs text-green-400">WRITE_ACCEPTED</span> and{" "}
          <span className="font-mono text-xs text-green-400">WRITE_ACKNOWLEDGED</span> both fire
          before any follower has necessarily received anything. Kill the leader right after, and
          a value a client already believes succeeded can simply be gone.
        </p>
      </TheorySection>

      <TheorySection heading="Sync: durable, but with no escape hatch">
        <p>
          Sync mode waits for every currently-alive follower to reply with its own{" "}
          <span className="font-mono text-xs text-green-400">WRITE_REPLICATED</span> before
          acknowledging. That&apos;s durable — but a single follower dying after the write was sent
          and before it acks leaves that write stuck <strong className="text-text-primary">permanently</strong>.
          There is no timeout and no majority escape hatch in this module on purpose — Quorum is
          where that gets solved.
        </p>
      </TheorySection>

      <TheorySection heading="Same write, same fault, different outcome">
        <p>
          The whole point of this module is running the exact same write, under the exact same
          fault, in both modes side by side — async survives it and loses data; sync refuses to
          lose data and gets stuck instead. Neither is simply &quot;better&quot;; they trade
          away different things.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          Consistency asks the other half of this question: given this exact replication setup,
          what can a <em>client reading</em> the data actually observe?
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

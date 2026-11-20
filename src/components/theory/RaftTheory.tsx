import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function RaftTheory() {
  return (
    <TheoryDialog title="Theory — Raft">
      <TheorySection heading="Three pieces, one algorithm">
        <p>
          Raft composes three things you can already reason about individually: leader election (a
          majority vote instead of Bully&apos;s priority rule), log replication (like
          Replication&apos;s leader/follower store), and majority commit safety (like
          Quorum&apos;s threshold). Nothing here is conceptually new — it&apos;s the same pieces,
          assembled into one real algorithm.
        </p>
      </TheorySection>

      <TheorySection heading="A term is a lie detector for leadership">
        <p>
          Every node tracks a <span className="font-mono text-xs">currentTerm</span>. A message
          carrying an older term is instantly recognizable as stale; a message carrying a newer
          term makes the receiver step down immediately, no matter what it currently believes.
          This is how Raft solves the problem Bully&apos;s priority rule never had to: telling a
          <em> current</em> leader from a stale one.
        </p>
      </TheorySection>

      <TheorySection heading="Bootstrapping is manual; everything after is automatic">
        <p>
          Start one election by hand to give the cluster its first leader. After that, heartbeats
          and election timeouts run entirely on their own — kill the leader and watch a follower&apos;s
          own timeout fire and start a new election with no further clicks.
        </p>
      </TheorySection>

      <TheorySection heading="Committing only counts entries from the CURRENT term">
        <p>
          A leader only commits a log entry once a majority holds it — but only ever counts
          replication of an entry <strong className="text-text-primary">from its own current
          term</strong> toward that majority, never an inherited older-term entry by count alone.
          This is Raft&apos;s core safety subtlety: it&apos;s what stops an entry from a crashed,
          never-truly-committed prior leader from being resurrected as if it were safe.
        </p>
      </TheorySection>

      <TheorySection heading="A minority can accept writes that can never commit">
        <p>
          Partition the leader into a minority and submit an entry — it&apos;s accepted into that
          leader&apos;s own log, but its commit index never advances, no matter how long you wait.
          A minority can never fake a majority; that&apos;s not a bug, it&apos;s the guarantee.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          Fault Injection composes multiple faults against this exact engine at once — partition
          plus a well-timed kill plus a delayed vote — to build real confidence in these
          guarantees under adversarial timing, not just the clean happy path.
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

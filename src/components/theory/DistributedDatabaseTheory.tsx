import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function DistributedDatabaseTheory() {
  return (
    <TheoryDialog title="Theory — Distributed Database">
      <TheorySection heading="A state machine, not a new protocol">
        <p>
          PUT and GET aren&apos;t a new consensus mechanism — PUT is Raft&apos;s existing{" "}
          <span className="font-mono text-xs">SUBMIT_ENTRY</span>, with its value encoded as{" "}
          <span className="font-mono text-xs">key=value</span>. Election, replication, and commit
          safety are all completely unmodified. This module proves those pieces support a real
          client-visible application; it doesn&apos;t add a new one.
        </p>
      </TheorySection>

      <TheorySection heading="GET is a question, never an action">
        <p>
          GET dispatches nothing at all — it&apos;s a pure read of a node&apos;s own committed
          key-value view, built by applying that node&apos;s own committed log entries in order.
          &quot;Given everything this node has committed so far, what would it answer?&quot; is
          the entire operation; nothing about asking the question changes what happened.
        </p>
      </TheorySection>

      <TheorySection heading="Every node's own view can genuinely lag">
        <p>
          A node&apos;s KV view is a function of its own log and its own commit progress —
          never the cluster&apos;s. GET the same key from the leader and from a lagging or
          partitioned follower, and you can watch them disagree, exactly like Consistency&apos;s
          stale reads, except now it&apos;s Raft&apos;s real per-node commit progression producing
          the effect, not a simplified ack count.
        </p>
      </TheorySection>

      <TheorySection heading="A leader failure loses nothing that was truly committed">
        <p>
          PUT a key, let it commit, kill the leader, elect a new one, then GET that key from the
          new leader — it&apos;s still there. This isn&apos;t a database-specific guarantee; it
          falls straight out of Raft&apos;s own commit safety, which was never rebuilt for this
          module.
        </p>
      </TheorySection>

      <TheorySection heading="Only the leader ever writes">
        <p>
          PUT on a node that isn&apos;t currently the leader is rejected — the same
          reject-not-crash precedent every module in this project uses for an invalid command.
          There&apos;s no auto-routing to the leader on your behalf; knowing who the leader is was
          exactly what Election and Raft already taught you to observe.
        </p>
      </TheorySection>

      <TheorySection heading="The whole arc, in one module">
        <p>
          Networking&apos;s deterministic messaging, Election/Raft&apos;s coordination, and
          Replication/Consistency/Quorum&apos;s data-consistency questions all show up here at
          once, doing real work for an application a client would actually use. That composition
          — not a new algorithm — is the capstone.
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function ElectionTheory() {
  return (
    <TheoryDialog title="Theory — Leader Election (Bully)">
      <TheorySection heading="The rule: highest-numbered alive node wins">
        <p>
          Five nodes, numbered 1-5 — the node&apos;s own id <em>is</em> its priority. The rule is
          simple to state: the highest-numbered node that&apos;s still alive always becomes
          leader. The algorithm exists entirely because every node has to discover that fact
          through messages, not by magic — nobody can see who else is alive.
        </p>
      </TheorySection>

      <TheorySection heading="How an election actually bubbles up">
        <p>
          Starting an election sends <span className="font-mono text-xs">election</span> messages
          to every higher-numbered node. Each one that&apos;s alive replies{" "}
          <span className="font-mono text-xs">ok</span> and starts its own election against nodes
          higher than itself. Eventually the true highest-numbered alive node runs out of anyone
          higher to ask, and declares itself leader with a{" "}
          <span className="font-mono text-xs">coordinator</span> broadcast.
        </p>
      </TheorySection>

      <TheorySection heading="A leader asked again reasserts, it doesn't go silent">
        <p>
          If a stray <span className="font-mono text-xs">election</span> message reaches a node
          that&apos;s already the leader (say, after a re-election it wasn&apos;t part of), it
          doesn&apos;t just reply OK and stop — it reasserts itself with another{" "}
          <span className="font-mono text-xs">coordinator</span> message. Otherwise the asker
          would wait out a full timeout before learning a leader already exists, for no reason.
        </p>
      </TheorySection>

      <TheorySection heading="A partition can produce a locally-correct wrong answer">
        <p>
          Partition the highest-numbered node away first, and the remaining group correctly elects
          the highest-numbered node <em>it can see</em> — which is a real leader by the rule as
          far as that group knows, but wouldn&apos;t have won had everyone been reachable. Healing
          the partition afterward doesn&apos;t automatically fix this; it takes a fresh election.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          Raft answers the same &quot;who&apos;s in charge&quot; question with a majority vote and
          a term number instead of a fixed priority rule — so any node can tell a current leader
          from a stale one, which Bully&apos;s pure priority rule has no way to express.
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

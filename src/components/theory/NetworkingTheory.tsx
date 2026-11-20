import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function NetworkingTheory() {
  return (
    <TheoryDialog title="Theory — Networking">
      <TheorySection heading="What is a link, here?">
        <p>
          Every link in this module has a fixed <strong className="text-text-primary">latency</strong> —
          a number of ticks a message spends in flight before it can possibly arrive. A message sent at
          tick 0 on a 3-tick link cannot be delivered before tick 3, no matter what. This is the one fact
          every later module in this project builds on: <em>nothing is instantaneous</em>.
        </p>
      </TheorySection>

      <TheorySection heading="Sending a message">
        <p>
          Clicking &quot;Send&quot; doesn&apos;t move a packet directly — it commits a{" "}
          <span className="font-mono text-xs text-green-400">MESSAGE_SENT</span> event to the log, which
          records who sent it, who it&apos;s addressed to, and exactly which tick it&apos;s scheduled to
          arrive. The packet glyph you see traveling across the canvas is a picture of that event, not the
          thing that actually happened — the event is the ground truth; everything visual is a rendering
          of it.
        </p>
      </TheorySection>

      <TheorySection heading="Delivery is exact, not eventual">
        <p>
          <span className="font-mono text-xs text-green-400">MESSAGE_DELIVERED</span> commits at precisely
          the scheduled tick — not a tick early, not a tick late. Scrub the timeline back and forth across
          that exact tick and watch the packet disappear at exactly the right frame, every time. Same
          input, same result — this determinism is what makes replay and scrubbing possible at all.
        </p>
      </TheorySection>

      <TheorySection heading="A message can fail for more than one reason">
        <p>
          <span className="font-mono text-xs text-red-400">MESSAGE_DROPPED</span> is a single event type,
          but it always carries an explicit <strong className="text-text-primary">reason</strong>, since the
          network itself never announces why something didn&apos;t arrive:
        </p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-mono text-xs">manual</span>
            {" — you selected an in-flight message and dropped it directly."}
          </li>
          <li>
            <span className="font-mono text-xs">destination-crashed</span>
            {" — the message was already in flight when its target died; it still gets delivered as an event, but discarded on arrival."}
          </li>
          <li>
            <span className="font-mono text-xs">partitioned</span>
            {" — the network was split into groups that can't reach each other. No node ever finds out; it just looks like silence."}
          </li>
          <li>
            <span className="font-mono text-xs">random-loss</span>
            {" — a configured drop-rate percentage, lost purely by chance, with no other cause at all."}
          </li>
        </ul>
      </TheorySection>

      <TheorySection heading="Reordering and duplication are real events too">
        <p>
          <span className="font-mono text-xs text-yellow-400">MESSAGE_REORDERED</span> and{" "}
          <span className="font-mono text-xs text-yellow-400">MESSAGE_DUPLICATED</span> aren&apos;t visual
          tricks layered on top of the simulation — reordering actually changes a message&apos;s scheduled
          delivery tick, and duplication actually schedules a second, independent delivery. Every module
          after this one inherits this same transport unmodified, faults included.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          Every later module — Replication, Raft, Quorum, all of them — sends its own protocol messages
          over this exact same transport, with the exact same latency/drop/partition rules. Networking
          isn&apos;t a warm-up you leave behind; it&apos;s the substrate everything else runs on.
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

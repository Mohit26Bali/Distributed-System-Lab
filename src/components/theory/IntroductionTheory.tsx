import { TheoryDialog } from "./TheoryDialog";
import { TheorySection } from "./TheorySection";

export function IntroductionTheory() {
  return (
    <TheoryDialog title="Theory — Introduction">
      <TheorySection heading="What this module is for">
        <p>
          This isn&apos;t a distributed-systems concept — it&apos;s an orientation to the platform
          itself, using the simplest possible network (two nodes, one link) as the running
          example. Every module after this one assumes you already know how to use the controls,
          so it doesn&apos;t have to re-teach UI mechanics inside its own lesson.
        </p>
      </TheorySection>

      <TheorySection heading="Everything is a committed event">
        <p>
          Nothing you see is a decoration. A node, a packet, a color change — each one exists
          because a specific event committed to the log at a specific tick. If you can&apos;t find
          the event that explains what you&apos;re looking at, that&apos;s a bug, not a mystery.
        </p>
      </TheorySection>

      <TheorySection heading="The timeline is not a video">
        <p>
          Scrubbing backward doesn&apos;t rewind an animation — it re-derives the entire canvas
          from the event log up through whatever tick you land on. Every view in this app,
          including this one, is a pure function of <span className="font-mono text-xs">(events, tick)</span>.
          That&apos;s what makes scrubbing, replay, and determinism all the same underlying fact.
        </p>
      </TheorySection>

      <TheorySection heading="Faults are real, not visual effects">
        <p>
          Killing a node or dropping a message doesn&apos;t just change how something looks — it
          changes what the simulation actually does afterward, the same way it would on a real
          machine. The fault menu you&apos;ll use in every later module is doing real work here
          too, on this simplest possible network.
        </p>
      </TheorySection>

      <TheorySection heading="What's next">
        <p>
          Module 1 (Networking) is where the network itself becomes the subject: real latency,
          real packet loss, real partitions — the substrate every later module runs its own
          protocol on top of.
        </p>
      </TheorySection>
    </TheoryDialog>
  );
}

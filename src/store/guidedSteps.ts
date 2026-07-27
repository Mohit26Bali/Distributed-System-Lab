import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";
import { NODE_EVENT_TYPES, type NodeCrashedPayload } from "@/simulation/events/nodeEvents";

export interface GuidedStepDefinition {
  id: string;
  instruction: string;
  observation: string;
  /**
   * True once this step's expected fact has been committed. Only ever given
   * the events committed SINCE this step began — a leftover event from
   * before the step started (or satisfying a later step) must never count.
   * Checked against the log, never against which button was clicked.
   */
  isSatisfied: (eventsSinceStepStart: readonly SimEvent[]) => boolean;
}

function hasEventType(events: readonly SimEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

export const NETWORKING_GUIDED_STEPS: GuidedStepDefinition[] = [
  {
    id: "send-ping",
    instruction: "Send a ping from A to B using the button above the canvas.",
    observation:
      "A packet appeared — it only exists because MESSAGE_SENT just committed to the log.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_SENT),
  },
  {
    id: "advance-to-delivery",
    instruction: "Step the simulation forward until the message is delivered.",
    observation:
      "The packet vanished the instant MESSAGE_DELIVERED committed — not a tick before, not a tick after.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_DELIVERED),
  },
  {
    id: "kill-node-b",
    instruction: 'Select node B, then click "Kill Node" in the fault menu at the bottom right.',
    observation: "Node B is crashed now — a real NODE_CRASHED event, not just a color change.",
    isSatisfied: (events) =>
      events.some(
        (event) =>
          event.type === NODE_EVENT_TYPES.NODE_CRASHED &&
          (event.payload as NodeCrashedPayload).nodeId === "b",
      ),
  },
  {
    id: "send-to-crashed-node",
    instruction: "Send another ping to B, then step forward until it resolves.",
    observation:
      "This time it was dropped, not delivered — the destination was already dead when it arrived.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_DROPPED),
  },
  {
    id: "manual-drop",
    instruction: 'Select any in-flight message and click "Drop Message" in the fault menu.',
    observation:
      "Same MESSAGE_DROPPED event as before — the log records that a message never arrived, not why.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_DROPPED),
  },
];

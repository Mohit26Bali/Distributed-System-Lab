import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES, type MessageDroppedPayload } from "@/simulation/events/networkEvents";
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

// Order matters here: killing node B (below) is permanent for the rest of
// the session — no recovery mechanic exists yet (see docs/09). Every step
// that needs B reachable-but-not-crashed (manual drop, partition, drop
// rate) must come BEFORE kill-node-b, or its destination-crashed check
// would always win and the intended reason could never be demonstrated.
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
    id: "manual-drop",
    instruction: 'Send another ping, select it while in flight, and click "Drop Message."',
    observation:
      "MESSAGE_DROPPED — the log records that a message never arrived, not why. Check the inspector's reason.",
    isSatisfied: (events) => hasEventType(events, NETWORK_EVENT_TYPES.MESSAGE_DROPPED),
  },
  {
    id: "partition-drop",
    instruction:
      'Click "Partition" in the fault menu, then send a ping across the split and step forward until it resolves.',
    observation:
      'Dropped again — but check the inspector: this one\'s reason is "partitioned," not a crash or a random loss. The network doesn\'t announce a partition; you only see silence.',
    isSatisfied: (events) =>
      events.some(
        (event) =>
          event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED &&
          (event.payload as MessageDroppedPayload).reason === "partitioned",
      ),
  },
  {
    id: "adjustable-drop-rate",
    instruction:
      "Heal the partition, set the drop rate slider to 100% in Network Configuration, apply it, then send one more ping and step forward until it resolves.",
    observation:
      'This message never even reached a crashed node or a partition — it was lost purely by chance, reason "random-loss." Same event type, same inspector shape, a third distinct cause.',
    isSatisfied: (events) =>
      events.some(
        (event) =>
          event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED &&
          (event.payload as MessageDroppedPayload).reason === "random-loss",
      ),
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
    instruction: "Send one last ping to B, then step forward until it resolves.",
    observation:
      "Dropped, reason \"destination-crashed\" — the message never had a chance, since B was already dead when it arrived.",
    isSatisfied: (events) =>
      events.some(
        (event) =>
          event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED &&
          (event.payload as MessageDroppedPayload).reason === "destination-crashed",
      ),
  },
];

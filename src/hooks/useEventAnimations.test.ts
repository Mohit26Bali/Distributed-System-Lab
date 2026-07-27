import { describe, expect, it } from "vitest";
import { deriveActivePackets } from "./useEventAnimations";
import type { SimEvent } from "@/simulation/engine/types";

function sentEvent(tick: number, messageId: string, sentTick: number, deliveredTick: number): SimEvent {
  return {
    id: `sent-${messageId}`,
    tick,
    type: "MESSAGE_SENT",
    moduleId: "networking",
    payload: { messageId, from: "a", to: "b", sentTick, deliveredTick },
  };
}

function deliveredEvent(tick: number, messageId: string): SimEvent {
  return {
    id: `delivered-${messageId}`,
    tick,
    type: "MESSAGE_DELIVERED",
    moduleId: "networking",
    payload: { messageId },
  };
}

function droppedEvent(tick: number, messageId: string): SimEvent {
  return {
    id: `dropped-${messageId}`,
    tick,
    type: "MESSAGE_DROPPED",
    moduleId: "networking",
    payload: { messageId },
  };
}

describe("deriveActivePackets", () => {
  it("shows a packet in flight with partial progress between sent and delivered ticks", () => {
    const events = [sentEvent(0, "msg-0", 0, 3)];
    const packets = deriveActivePackets(events, 1);

    expect(packets).toHaveLength(1);
    expect(packets[0].progress).toBeCloseTo(1 / 3);
  });

  it("hides a packet whose MESSAGE_SENT is in the future relative to the viewed tick", () => {
    const events = [sentEvent(5, "msg-0", 5, 8)];
    expect(deriveActivePackets(events, 2)).toHaveLength(0);
  });

  it("hides a packet once its MESSAGE_DELIVERED is at or before the viewed tick", () => {
    const events = [sentEvent(0, "msg-0", 0, 3), deliveredEvent(3, "msg-0")];
    expect(deriveActivePackets(events, 3)).toHaveLength(0);
  });

  it(
    "regression: a packet already delivered LATER in a live log still shows as in-flight " +
      "when viewing an earlier tick — the log's future must not leak backward",
    () => {
      // Simulates scrubbing back on a log that has already advanced past
      // delivery: both events are present, but we're viewing tick 1.
      const events = [sentEvent(0, "msg-0", 0, 3), deliveredEvent(3, "msg-0")];

      const packets = deriveActivePackets(events, 1);
      expect(packets).toHaveLength(1);
      expect(packets[0].progress).toBeCloseTo(1 / 3);
    },
  );

  it("shows a dropped packet with status 'dropped' exactly at the tick it was dropped", () => {
    const events = [sentEvent(0, "msg-0", 0, 3), droppedEvent(2, "msg-0")];

    const packets = deriveActivePackets(events, 2);
    expect(packets).toHaveLength(1);
    expect(packets[0].status).toBe("dropped");
    expect(packets[0].progress).toBeCloseTo(2 / 3);
  });

  it("hides a dropped packet on any tick other than the exact tick it was dropped", () => {
    const events = [sentEvent(0, "msg-0", 0, 3), droppedEvent(2, "msg-0")];

    expect(deriveActivePackets(events, 1)).toHaveLength(1); // still in flight, before the drop
    expect(deriveActivePackets(events, 1)[0].status).toBe("in-flight");
    expect(deriveActivePackets(events, 3)).toHaveLength(0); // one tick after the drop, gone
  });

  it("a message dropped due to a crashed destination looks identical to a manual drop", () => {
    // From the animation's perspective there is no difference between why
    // a message was dropped — both produce the same MESSAGE_DROPPED shape.
    const events = [sentEvent(0, "msg-0", 0, 3), droppedEvent(3, "msg-0")];

    const packets = deriveActivePackets(events, 3);
    expect(packets).toEqual([{ id: "msg-0", from: "a", to: "b", progress: 1, status: "dropped" }]);
  });
});

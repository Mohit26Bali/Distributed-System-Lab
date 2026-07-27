import { describe, expect, it } from "vitest";
import { deriveMessageDetail } from "./useMessageDetail";
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

describe("deriveMessageDetail", () => {
  it("returns undefined when the message has not been sent yet as of viewTick", () => {
    const events = [sentEvent(5, "msg-0", 5, 8)];
    expect(deriveMessageDetail(events, "msg-0", 2)).toBeUndefined();
  });

  it("returns undefined for an unknown message id", () => {
    const events = [sentEvent(0, "msg-0", 0, 3)];
    expect(deriveMessageDetail(events, "msg-does-not-exist", 5)).toBeUndefined();
  });

  it("reports in-flight status and full sent/delivered ticks before delivery", () => {
    const events = [sentEvent(0, "msg-0", 0, 3)];
    const detail = deriveMessageDetail(events, "msg-0", 1);

    expect(detail).toEqual({
      messageId: "msg-0",
      from: "a",
      to: "b",
      sentTick: 0,
      deliveredTick: 3,
      status: "in-flight",
    });
  });

  it("reports delivered status once viewTick reaches the delivered tick", () => {
    const events = [sentEvent(0, "msg-0", 0, 3), deliveredEvent(3, "msg-0")];
    expect(deriveMessageDetail(events, "msg-0", 3)?.status).toBe("delivered");
  });

  it(
    "regression: a message delivered LATER in a live log still reports in-flight " +
      "when viewing an earlier tick",
    () => {
      const events = [sentEvent(0, "msg-0", 0, 3), deliveredEvent(3, "msg-0")];
      expect(deriveMessageDetail(events, "msg-0", 1)?.status).toBe("in-flight");
    },
  );

  it("reports dropped status once viewTick reaches the tick the message was dropped", () => {
    const events = [sentEvent(0, "msg-0", 0, 3), droppedEvent(2, "msg-0")];
    expect(deriveMessageDetail(events, "msg-0", 2)?.status).toBe("dropped");
  });

  it("still reports in-flight before the drop tick, even though the log already has the drop", () => {
    const events = [sentEvent(0, "msg-0", 0, 3), droppedEvent(2, "msg-0")];
    expect(deriveMessageDetail(events, "msg-0", 1)?.status).toBe("in-flight");
  });
});

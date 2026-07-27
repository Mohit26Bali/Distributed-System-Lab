import { describe, expect, it } from "vitest";
import { NETWORKING_CHALLENGE } from "./challenges";
import type { SimEvent } from "@/simulation/engine/types";

function eventOf(type: string, tick = 0): SimEvent {
  return { id: `e-${type}-${tick}-${Math.random()}`, tick, type, moduleId: "networking", payload: {} };
}

describe("NETWORKING_CHALLENGE.isComplete", () => {
  it("fails when the log has no MESSAGE_DROPPED event", () => {
    expect(NETWORKING_CHALLENGE.isComplete([])).toBe(false);
    expect(
      NETWORKING_CHALLENGE.isComplete([eventOf("MESSAGE_SENT"), eventOf("MESSAGE_DELIVERED")]),
    ).toBe(false);
  });

  it("passes when the log has a MESSAGE_DROPPED event", () => {
    expect(NETWORKING_CHALLENGE.isComplete([eventOf("MESSAGE_DROPPED")])).toBe(true);
  });

  it("passes regardless of what else happened alongside it (any valid path)", () => {
    const events = [
      eventOf("MESSAGE_SENT"),
      eventOf("MESSAGE_DELIVERED"),
      eventOf("NODE_CRASHED"),
      eventOf("MESSAGE_SENT"),
      eventOf("MESSAGE_DROPPED"),
    ];
    expect(NETWORKING_CHALLENGE.isComplete(events)).toBe(true);
  });

  it("passes even if the drop happened earlier in the session, not just 'just now'", () => {
    // Unlike a guided step, a challenge asks "can you make this true" --
    // an already-achieved fact from earlier still counts.
    const events = [eventOf("MESSAGE_DROPPED", 2), eventOf("MESSAGE_SENT", 5)];
    expect(NETWORKING_CHALLENGE.isComplete(events)).toBe(true);
  });
});

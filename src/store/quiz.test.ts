import { describe, expect, it } from "vitest";
import { NETWORKING_QUIZ } from "./quiz";
import type { SimEvent } from "@/simulation/engine/types";

function eventOf(type: string, tick = 0): SimEvent {
  return { id: `e-${type}-${tick}-${Math.random()}`, tick, type, moduleId: "networking", payload: {} };
}

describe("NETWORKING_QUIZ.resolveOutcome", () => {
  it("returns undefined when nothing has resolved yet", () => {
    expect(NETWORKING_QUIZ.resolveOutcome([])).toBeUndefined();
    expect(NETWORKING_QUIZ.resolveOutcome([eventOf("MESSAGE_SENT")])).toBeUndefined();
  });

  it("returns 'delivered' when a MESSAGE_DELIVERED event is present", () => {
    expect(NETWORKING_QUIZ.resolveOutcome([eventOf("MESSAGE_DELIVERED")])).toBe("delivered");
  });

  it("returns 'dropped' when a MESSAGE_DROPPED event is present", () => {
    expect(NETWORKING_QUIZ.resolveOutcome([eventOf("MESSAGE_DROPPED")])).toBe("dropped");
  });

  it("every option id returned by resolveOutcome corresponds to a real quiz option", () => {
    const optionIds = new Set(NETWORKING_QUIZ.options.map((o) => o.id));
    expect(optionIds.has(NETWORKING_QUIZ.resolveOutcome([eventOf("MESSAGE_DELIVERED")])!)).toBe(
      true,
    );
    expect(optionIds.has(NETWORKING_QUIZ.resolveOutcome([eventOf("MESSAGE_DROPPED")])!)).toBe(
      true,
    );
  });
});

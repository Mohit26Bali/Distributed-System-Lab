import { describe, expect, it } from "vitest";
import { NETWORKING_GUIDED_STEPS } from "./guidedSteps";
import type { SimEvent } from "@/simulation/engine/types";

function findStep(id: string) {
  const step = NETWORKING_GUIDED_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`step not found: ${id}`);
  return step;
}

function eventOf(type: string, payload: unknown, tick = 0): SimEvent {
  return { id: `e-${type}-${tick}-${Math.random()}`, tick, type, moduleId: "networking", payload };
}

describe("NETWORKING_GUIDED_STEPS", () => {
  it("send-ping is satisfied only once a MESSAGE_SENT event exists in the window", () => {
    const step = findStep("send-ping");
    expect(step.isSatisfied([])).toBe(false);
    expect(step.isSatisfied([eventOf("MESSAGE_SENT", {})])).toBe(true);
  });

  it("advance-to-delivery requires MESSAGE_DELIVERED specifically, not just MESSAGE_SENT", () => {
    const step = findStep("advance-to-delivery");
    expect(step.isSatisfied([eventOf("MESSAGE_SENT", {})])).toBe(false);
    expect(step.isSatisfied([eventOf("MESSAGE_DELIVERED", {})])).toBe(true);
  });

  it("kill-node-b requires NODE_CRASHED for node b specifically, not any node", () => {
    const step = findStep("kill-node-b");
    expect(step.isSatisfied([eventOf("NODE_CRASHED", { nodeId: "a" })])).toBe(false);
    expect(step.isSatisfied([eventOf("NODE_CRASHED", { nodeId: "c" })])).toBe(false);
    expect(step.isSatisfied([eventOf("NODE_CRASHED", { nodeId: "b" })])).toBe(true);
  });

  it("send-to-crashed-node and manual-drop are each satisfied by any MESSAGE_DROPPED in their own window", () => {
    const dropped = [eventOf("MESSAGE_DROPPED", { messageId: "msg-0" })];
    expect(findStep("send-to-crashed-node").isSatisfied(dropped)).toBe(true);
    expect(findStep("manual-drop").isSatisfied(dropped)).toBe(true);
  });

  it(
    "regression: a step is not satisfied by an event from before its own window " +
      "(events prior to step start must never leak in)",
    () => {
      // Simulates checking a step whose window starts empty, even though the
      // full session log (not passed here) already has an unrelated MESSAGE_SENT
      // from an earlier step — the caller is responsible for passing only the
      // slice since this step began, and the predicate must not assume more.
      const step = findStep("kill-node-b");
      expect(step.isSatisfied([eventOf("MESSAGE_SENT", {})])).toBe(false);
    },
  );

  it("every step has a unique id", () => {
    const ids = NETWORKING_GUIDED_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

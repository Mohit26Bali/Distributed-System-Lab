import { describe, expect, it } from "vitest";
import { deriveIsPartitioned } from "./useLinkStatus";
import type { SimEvent } from "@/simulation/engine/types";

function partitionStarted(tick: number, groups: string[][]): SimEvent {
  return {
    id: `partition-${tick}`,
    tick,
    type: "PARTITION_STARTED",
    moduleId: "networking",
    payload: { groups },
  };
}

function partitionHealed(tick: number): SimEvent {
  return { id: `heal-${tick}`, tick, type: "PARTITION_HEALED", moduleId: "networking", payload: {} };
}

describe("deriveIsPartitioned", () => {
  it("returns false when no partition has ever started", () => {
    expect(deriveIsPartitioned([], "a", "b", 5)).toBe(false);
  });

  it("returns true for nodes in different groups", () => {
    const events = [partitionStarted(0, [["a"], ["b", "c"]])];
    expect(deriveIsPartitioned(events, "a", "b", 5)).toBe(true);
  });

  it("returns false for nodes in the same group", () => {
    const events = [partitionStarted(0, [["a"], ["b", "c"]])];
    expect(deriveIsPartitioned(events, "b", "c", 5)).toBe(false);
  });

  it("returns false again after a PARTITION_HEALED event", () => {
    const events = [partitionStarted(0, [["a"], ["b", "c"]]), partitionHealed(2)];
    expect(deriveIsPartitioned(events, "a", "b", 5)).toBe(false);
  });

  it(
    "regression: a partition started LATER in a live log must not apply when viewing an earlier tick",
    () => {
      const events = [partitionStarted(5, [["a"], ["b", "c"]])];
      expect(deriveIsPartitioned(events, "a", "b", 2)).toBe(false);
    },
  );

  it("a heal that happens LATER must not apply when viewing a tick before it", () => {
    const events = [partitionStarted(0, [["a"], ["b", "c"]]), partitionHealed(10)];
    expect(deriveIsPartitioned(events, "a", "b", 5)).toBe(true);
  });
});

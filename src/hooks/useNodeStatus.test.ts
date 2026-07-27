import { describe, expect, it } from "vitest";
import { deriveNodeStatus } from "./useNodeStatus";
import type { SimEvent } from "@/simulation/engine/types";

function crashedEvent(tick: number, nodeId: string): SimEvent {
  return {
    id: `crashed-${nodeId}-${tick}`,
    tick,
    type: "NODE_CRASHED",
    moduleId: "networking",
    payload: { nodeId },
  };
}

describe("deriveNodeStatus", () => {
  it("returns 'alive' when no crash event exists", () => {
    expect(deriveNodeStatus([], "a", 5)).toBe("alive");
  });

  it("returns 'crashed' once a NODE_CRASHED event for that node occurs at or before the viewed tick", () => {
    const events = [crashedEvent(2, "a")];
    expect(deriveNodeStatus(events, "a", 2)).toBe("crashed");
    expect(deriveNodeStatus(events, "a", 5)).toBe("crashed");
  });

  it("is unaffected by crash events for other node ids", () => {
    const events = [crashedEvent(2, "b")];
    expect(deriveNodeStatus(events, "a", 5)).toBe("alive");
  });

  it(
    "regression: a node crashed LATER in a live log still reports alive " +
      "when viewing an earlier tick",
    () => {
      const events = [crashedEvent(5, "a")];
      expect(deriveNodeStatus(events, "a", 2)).toBe("alive");
    },
  );

  it("returns 'alive' when nodeId is null", () => {
    expect(deriveNodeStatus([crashedEvent(0, "a")], null, 5)).toBe("alive");
  });
});

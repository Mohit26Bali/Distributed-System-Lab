import { describe, expect, it } from "vitest";
import { NetworkModel } from "./NetworkModel";

describe("NetworkModel", () => {
  it("returns the configured latency for a link, in either direction", () => {
    const network = new NetworkModel([{ id: "a-b", from: "a", to: "b", latencyTicks: 3 }]);

    expect(network.getLatency("a", "b")).toBe(3);
    expect(network.getLatency("b", "a")).toBe(3);
  });

  it("throws when no link exists between the given nodes", () => {
    const network = new NetworkModel([{ id: "a-b", from: "a", to: "b", latencyTicks: 3 }]);

    expect(() => network.getLatency("a", "c")).toThrow();
  });
});

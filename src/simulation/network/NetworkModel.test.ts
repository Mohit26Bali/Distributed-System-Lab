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

  it("defaults dropRate to 0 when not configured", () => {
    const network = new NetworkModel([{ id: "a-b", from: "a", to: "b", latencyTicks: 3 }]);
    expect(network.getDropRate("a", "b")).toBe(0);
  });

  it("honors an explicitly configured dropRate", () => {
    const network = new NetworkModel([
      { id: "a-b", from: "a", to: "b", latencyTicks: 3, dropRate: 0.5 },
    ]);
    expect(network.getDropRate("a", "b")).toBe(0.5);
  });

  it("reports no partition by default", () => {
    const network = new NetworkModel([{ id: "a-b", from: "a", to: "b", latencyTicks: 3 }]);
    expect(network.isPartitioned("a", "b")).toBe(false);
  });

  describe("applyPatch", () => {
    it("partitions nodes in different groups, but not nodes in the same group", () => {
      const network = new NetworkModel([
        { id: "a-b", from: "a", to: "b", latencyTicks: 3 },
        { id: "b-c", from: "b", to: "c", latencyTicks: 3 },
      ]);

      network.applyPatch({ partitionGroups: [["a"], ["b", "c"]] });

      expect(network.isPartitioned("a", "b")).toBe(true);
      expect(network.isPartitioned("b", "c")).toBe(false);
    });

    it("heals a partition when partitionGroups is explicitly null", () => {
      const network = new NetworkModel([{ id: "a-b", from: "a", to: "b", latencyTicks: 3 }]);
      network.applyPatch({ partitionGroups: [["a"], ["b"]] });
      expect(network.isPartitioned("a", "b")).toBe(true);

      network.applyPatch({ partitionGroups: null });
      expect(network.isPartitioned("a", "b")).toBe(false);
    });

    it("leaves partition state untouched when partitionGroups is omitted", () => {
      const network = new NetworkModel([{ id: "a-b", from: "a", to: "b", latencyTicks: 3 }]);
      network.applyPatch({ partitionGroups: [["a"], ["b"]] });

      network.applyPatch({ linkOverrides: [{ from: "a", to: "b", latencyTicks: 10 }] });

      expect(network.isPartitioned("a", "b")).toBe(true);
      expect(network.getLatency("a", "b")).toBe(10);
    });

    it("overrides latency and/or dropRate for a specific link only", () => {
      const network = new NetworkModel([
        { id: "a-b", from: "a", to: "b", latencyTicks: 3 },
        { id: "b-c", from: "b", to: "c", latencyTicks: 5 },
      ]);

      network.applyPatch({ linkOverrides: [{ from: "a", to: "b", latencyTicks: 8, dropRate: 0.25 }] });

      expect(network.getLatency("a", "b")).toBe(8);
      expect(network.getDropRate("a", "b")).toBe(0.25);
      expect(network.getLatency("b", "c")).toBe(5); // unaffected
    });

    it("a partial override only changes the specified field", () => {
      const network = new NetworkModel([
        { id: "a-b", from: "a", to: "b", latencyTicks: 3, dropRate: 0.1 },
      ]);

      network.applyPatch({ linkOverrides: [{ from: "a", to: "b", dropRate: 0.9 }] });

      expect(network.getLatency("a", "b")).toBe(3); // untouched
      expect(network.getDropRate("a", "b")).toBe(0.9);
    });
  });
});

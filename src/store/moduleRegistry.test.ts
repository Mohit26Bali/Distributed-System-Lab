import { describe, expect, it } from "vitest";
import { getModuleDefinition, MODULE_REGISTRY } from "./moduleRegistry";

describe("moduleRegistry", () => {
  it("returns the definition for a known module id", () => {
    const definition = getModuleDefinition("networking");
    expect(definition?.id).toBe("networking");
    expect(definition?.nodeIds).toEqual(["a", "b", "c"]);
  });

  it("returns undefined for an unknown module id", () => {
    expect(getModuleDefinition("does-not-exist")).toBeUndefined();
  });

  it("has at least two distinct modules with distinct explanation content", () => {
    const definitions = Object.values(MODULE_REGISTRY);
    expect(definitions.length).toBeGreaterThanOrEqual(2);

    const summaries = new Set(definitions.map((d) => d.summary));
    expect(summaries.size).toBe(definitions.length); // no two modules share a summary
  });

  it("every registered module's links only reference its own declared node ids", () => {
    for (const definition of Object.values(MODULE_REGISTRY)) {
      for (const link of definition.links) {
        expect(definition.nodeIds).toContain(link.from);
        expect(definition.nodeIds).toContain(link.to);
      }
    }
  });

  it("every registered module has a canvas position for each of its nodes", () => {
    for (const definition of Object.values(MODULE_REGISTRY)) {
      for (const nodeId of definition.nodeIds) {
        expect(definition.nodePositions[nodeId]).toBeDefined();
      }
    }
  });
});

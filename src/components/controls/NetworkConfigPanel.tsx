"use client";

import { useState } from "react";

import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";

/**
 * Uniform "apply to all links" sliders rather than per-link controls —
 * there's no link-selection interaction anywhere else in the UI, and
 * inventing one just for this would be scope beyond what this milestone
 * actually needs. Not event-derived history like everything else here:
 * it always shows the CURRENT slider position, not a scrubbed value, the
 * same way the module's original topology config isn't itself an event.
 */
export function NetworkConfigPanel() {
  const moduleId = useSimulationStore((state) => state.moduleId);
  const dispatch = useSimulationStore((state) => state.dispatch);
  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;

  const [latencyTicks, setLatencyTicks] = useState(3);
  const [dropRatePercent, setDropRatePercent] = useState(0);

  if (!definition) return null;

  function applyToAllLinks() {
    for (const link of definition!.links) {
      dispatch({
        type: "SET_LINK_CONFIG",
        from: link.from,
        to: link.to,
        latencyTicks,
        dropRate: dropRatePercent / 100,
      });
    }
  }

  return (
    <div className="space-y-2 rounded border border-border-subtle bg-bg-elevated p-3">
      <p className="text-xs font-medium text-text-secondary">Network configuration</p>

      <label className="block text-xs text-text-muted">
        Latency: <span className="font-mono text-text-primary">{latencyTicks} ticks</span>
        <input
          type="range"
          min={1}
          max={10}
          value={latencyTicks}
          onChange={(e) => setLatencyTicks(Number(e.target.value))}
          className="mt-1 block w-full"
        />
      </label>

      <label className="block text-xs text-text-muted">
        Drop rate: <span className="font-mono text-text-primary">{dropRatePercent}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={dropRatePercent}
          onChange={(e) => setDropRatePercent(Number(e.target.value))}
          className="mt-1 block w-full"
        />
      </label>

      <button
        type="button"
        onClick={applyToAllLinks}
        className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary hover:bg-bg-canvas"
      >
        Apply to all links
      </button>
    </div>
  );
}

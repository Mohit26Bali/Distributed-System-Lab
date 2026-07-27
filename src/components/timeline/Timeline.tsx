"use client";

import { useEventTimeline } from "@/hooks/useEventTimeline";
import { useSimulationStore } from "@/store/simulationStore";

import { EventMarker } from "./EventMarker";

export function Timeline() {
  const currentTick = useSimulationStore((state) => state.currentTick);
  const viewTick = useSimulationStore((state) => state.viewTick);
  const events = useSimulationStore((state) => state.events);
  const seek = useSimulationStore((state) => state.seek);

  const { markers } = useEventTimeline(events);
  const maxTick = Math.max(currentTick, 1);

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-1">
      <div className="text-xs text-text-secondary">
        Viewing tick <span className="font-mono text-text-primary">{viewTick}</span>
        {viewTick !== currentTick && <span className="ml-2 text-amber-400">(scrubbed)</span>}
      </div>

      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={maxTick}
        aria-valuenow={viewTick}
        className="relative h-6 w-full cursor-pointer rounded bg-bg-elevated"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          seek(Math.round(fraction * maxTick));
        }}
      >
        {markers.map((marker) => (
          <EventMarker
            key={marker.tick}
            tick={marker.tick}
            maxTick={maxTick}
            eventCount={marker.eventCount}
            onSeek={seek}
          />
        ))}
        <div
          className="pointer-events-none absolute top-0 h-full w-0.5 bg-sky-400"
          style={{ left: `${(viewTick / maxTick) * 100}%` }}
        />
      </div>
    </div>
  );
}

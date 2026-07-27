import { useMemo } from "react";

import type { SimEvent, Tick } from "@/simulation/engine/types";

export interface TimelineMarker {
  tick: Tick;
  eventCount: number;
}

/** Pure grouping of the event log by tick, for rendering timeline markers. */
export function deriveTimelineMarkers(events: readonly SimEvent[]): TimelineMarker[] {
  const counts = new Map<Tick, number>();
  for (const event of events) {
    counts.set(event.tick, (counts.get(event.tick) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([tick, eventCount]) => ({ tick, eventCount }))
    .sort((a, b) => a.tick - b.tick);
}

export function useEventTimeline(events: readonly SimEvent[]): { markers: TimelineMarker[] } {
  return useMemo(() => ({ markers: deriveTimelineMarkers(events) }), [events]);
}

import { describe, expect, it } from "vitest";
import { deriveTimelineMarkers } from "./useEventTimeline";
import type { SimEvent } from "@/simulation/engine/types";

function eventAt(tick: number): SimEvent {
  return { id: `event-${tick}-${Math.random()}`, tick, type: "MESSAGE_SENT", moduleId: "networking", payload: {} };
}

describe("deriveTimelineMarkers", () => {
  it("groups events by tick and counts them", () => {
    const markers = deriveTimelineMarkers([eventAt(2), eventAt(0), eventAt(2)]);

    expect(markers).toEqual([
      { tick: 0, eventCount: 1 },
      { tick: 2, eventCount: 2 },
    ]);
  });

  it("returns markers sorted by tick regardless of input order", () => {
    const markers = deriveTimelineMarkers([eventAt(5), eventAt(1), eventAt(3)]);
    expect(markers.map((m) => m.tick)).toEqual([1, 3, 5]);
  });

  it("returns an empty list when there are no events", () => {
    expect(deriveTimelineMarkers([])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { EventLog } from "./EventLog";
import type { SimEvent } from "./types";

function makeEvent(tick: number, id = `event-${tick}`): SimEvent {
  return { id, tick, type: "TICK", moduleId: "core", payload: {} };
}

describe("EventLog", () => {
  it("returns appended events in append order", () => {
    const log = new EventLog();
    log.append(makeEvent(1));
    log.append(makeEvent(2));

    expect(log.all().map((e) => e.tick)).toEqual([1, 2]);
  });

  it("upTo() returns only events at or before the given tick", () => {
    const log = new EventLog();
    log.append(makeEvent(1));
    log.append(makeEvent(2));
    log.append(makeEvent(3));

    expect(log.upTo(2).map((e) => e.tick)).toEqual([1, 2]);
    expect(log.upTo(0)).toEqual([]);
    expect(log.upTo(99).map((e) => e.tick)).toEqual([1, 2, 3]);
  });
});

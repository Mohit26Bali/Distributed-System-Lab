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

  it("append() produces a new array reference each time, not a mutated-in-place one", () => {
    // Regression test: consumers (React's useMemo, Zustand selectors) rely
    // on referential equality to detect "the log changed." If all() ever
    // returned the same array object across appends, memoized derivations
    // keyed only on the events reference would silently freeze forever.
    const log = new EventLog();
    const before = log.all();

    log.append(makeEvent(1));
    const after = log.all();

    expect(after).not.toBe(before);
    expect(after).toHaveLength(1);
  });
});

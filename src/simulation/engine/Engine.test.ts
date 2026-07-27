import { describe, expect, it } from "vitest";
import { Engine } from "./Engine";

describe("Engine", () => {
  it("advances the tick counter by exactly one per call", () => {
    const engine = new Engine();
    expect(engine.getCurrentTick()).toBe(0);

    engine.advance();
    expect(engine.getCurrentTick()).toBe(1);

    engine.advance();
    expect(engine.getCurrentTick()).toBe(2);
  });

  it("appends exactly one TICK event per advance, with the correct tick numbers", () => {
    const engine = new Engine();

    for (let i = 0; i < 10; i++) {
      engine.advance();
    }

    const events = engine.getEvents();
    expect(events).toHaveLength(10);
    events.forEach((event, index) => {
      expect(event.type).toBe("TICK");
      expect(event.tick).toBe(index + 1);
    });
  });

  it("returns the newly created events from advance()", () => {
    const engine = new Engine();
    const emitted = engine.advance();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(engine.getEvents()[0]);
  });

  it("is deterministic: two fresh engines advanced identically produce identical event logs", () => {
    const engineA = new Engine();
    const engineB = new Engine();

    for (let i = 0; i < 25; i++) {
      engineA.advance();
      engineB.advance();
    }

    expect(engineA.getEvents()).toEqual(engineB.getEvents());
  });
});

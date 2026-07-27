import { describe, expect, it } from "vitest";
import { Scheduler } from "./Scheduler";

describe("Scheduler", () => {
  it("starts at tick 0 and advances by exactly one per call", () => {
    const scheduler = new Scheduler();
    expect(scheduler.tick).toBe(0);

    expect(scheduler.advance()).toBe(1);
    expect(scheduler.advance()).toBe(2);
    expect(scheduler.tick).toBe(2);
  });

  it("exposes a TimerQueue instance for future behaviors to schedule against", () => {
    const scheduler = new Scheduler();
    expect(scheduler.getTimerQueue().size).toBe(0);
  });
});

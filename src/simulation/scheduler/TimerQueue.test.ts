import { describe, expect, it } from "vitest";
import { TimerQueue } from "./TimerQueue";

describe("TimerQueue", () => {
  it("returns only entries due at or before the given tick, ordered by due tick", () => {
    const queue = new TimerQueue<string>();
    queue.schedule(5, "fifth");
    queue.schedule(2, "second");
    queue.schedule(3, "third");

    const due = queue.popDue(3);
    expect(due.map((entry) => entry.payload)).toEqual(["second", "third"]);
    expect(queue.size).toBe(1);
  });

  it("does not return the same entry twice", () => {
    const queue = new TimerQueue<string>();
    queue.schedule(1, "only");

    expect(queue.popDue(1)).toHaveLength(1);
    expect(queue.popDue(1)).toHaveLength(0);
  });

  it("popDue returns nothing when nothing is due yet", () => {
    const queue = new TimerQueue<string>();
    queue.schedule(10, "later");

    expect(queue.popDue(5)).toEqual([]);
    expect(queue.size).toBe(1);
  });

  it("peekNextDueTick reflects the remaining minimum due tick", () => {
    const queue = new TimerQueue<string>();
    expect(queue.peekNextDueTick()).toBeUndefined();

    queue.schedule(7, "a");
    queue.schedule(4, "b");
    expect(queue.peekNextDueTick()).toBe(4);

    queue.popDue(4);
    expect(queue.peekNextDueTick()).toBe(7);
  });
});

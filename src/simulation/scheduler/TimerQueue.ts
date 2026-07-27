import type { Tick } from "../engine/types";

export interface TimerEntry<T> {
  id: string;
  dueTick: Tick;
  payload: T;
}

/**
 * Pending "do this at tick N" entries. Not yet consumed by any behavior in
 * this milestone — it exists so message/timer delivery (Milestone 5+) has a
 * correct, already-tested mechanism to schedule against instead of a rewrite.
 */
export class TimerQueue<T> {
  private entries: TimerEntry<T>[] = [];
  private nextId = 0;

  schedule(dueTick: Tick, payload: T): string {
    const id = `timer-${this.nextId++}`;
    this.entries.push({ id, dueTick, payload });
    return id;
  }

  /** Removes and returns all entries due at or before `tick`, ordered by due tick. */
  popDue(tick: Tick): TimerEntry<T>[] {
    const due = this.entries.filter((entry) => entry.dueTick <= tick);
    this.entries = this.entries.filter((entry) => entry.dueTick > tick);
    return due.sort((a, b) => a.dueTick - b.dueTick);
  }

  peekNextDueTick(): Tick | undefined {
    return this.entries.reduce<Tick | undefined>(
      (min, entry) => (min === undefined || entry.dueTick < min ? entry.dueTick : min),
      undefined,
    );
  }

  get size(): number {
    return this.entries.length;
  }
}

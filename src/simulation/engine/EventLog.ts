import type { SimEvent, Tick } from "./types";

/** Append-only history of everything the engine has ever done. */
export class EventLog {
  private events: SimEvent[] = [];

  append(event: SimEvent): void {
    // Reassigning (not .push()) gives every commit a new array reference,
    // which is what lets anything downstream (React's useMemo, Zustand
    // selectors) correctly detect "the log changed" via referential
    // equality instead of silently freezing on a mutated-in-place array.
    this.events = [...this.events, event];
  }

  all(): readonly SimEvent[] {
    return this.events;
  }

  upTo(tick: Tick): readonly SimEvent[] {
    return this.events.filter((event) => event.tick <= tick);
  }
}

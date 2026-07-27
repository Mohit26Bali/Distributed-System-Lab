import type { SimEvent, Tick } from "./types";

/** Append-only history of everything the engine has ever done. */
export class EventLog {
  private events: SimEvent[] = [];

  append(event: SimEvent): void {
    this.events.push(event);
  }

  all(): readonly SimEvent[] {
    return this.events;
  }

  upTo(tick: Tick): readonly SimEvent[] {
    return this.events.filter((event) => event.tick <= tick);
  }
}

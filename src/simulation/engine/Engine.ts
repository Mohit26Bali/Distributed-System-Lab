import { EventLog } from "./EventLog";
import { Scheduler } from "./Scheduler";
import type { SimEvent, Tick } from "./types";

/**
 * Standalone, framework-free simulation engine. No import here ever reaches
 * into react/zustand/src/components — see docs/01-architecture.md.
 */
export class Engine {
  private scheduler = new Scheduler();
  private eventLog = new EventLog();
  private nextEventId = 0;

  /**
   * Advances the simulation by exactly one tick. This milestone's only
   * behavior: emit one TICK event per advance, to prove the tick → event →
   * log mechanics before any real module exists (see
   * docs/09-implementation-roadmap.md, Milestone 3).
   */
  advance(): SimEvent[] {
    const tick = this.scheduler.advance();
    const event: SimEvent = {
      id: `event-${this.nextEventId++}`,
      tick,
      type: "TICK",
      moduleId: "core",
      payload: {},
    };
    this.eventLog.append(event);
    return [event];
  }

  getCurrentTick(): Tick {
    return this.scheduler.tick;
  }

  getEvents(): readonly SimEvent[] {
    return this.eventLog.all();
  }
}

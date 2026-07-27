import { EventLog } from "./EventLog";
import { Scheduler } from "./Scheduler";
import type { NetworkModel } from "../network/NetworkModel";
import type { ReduceResult, SimEvent, SimulationModule, Tick } from "./types";

/**
 * Standalone, framework-free simulation engine. No import here ever reaches
 * into react/zustand/src/components — see docs/01-architecture.md.
 *
 * Generic over a plugged-in module (docs/04-simulation-engine.md): the
 * engine never knows what "networking" or "raft" means, it only threads
 * state through reduce()/onTimer() and commits whatever events/schedule
 * requests come back.
 */
export class Engine<State, Action> {
  private scheduler = new Scheduler();
  private eventLog = new EventLog();
  private nextEventId = 0;
  private state: State;

  constructor(
    private readonly module: SimulationModule<State, Action>,
    private readonly network: NetworkModel,
  ) {
    this.state = module.initialState;
  }

  /** Applies a user/UI command immediately, at the current tick. */
  dispatch(action: Action): SimEvent[] {
    const tick = this.scheduler.tick;
    const result = this.module.reduce(this.state, action, { tick, network: this.network });
    return this.commit(result, tick);
  }

  /** Advances the simulation by exactly one tick, firing any due timers. */
  advance(): SimEvent[] {
    const tick = this.scheduler.advance();
    const due = this.scheduler.getTimerQueue().popDue(tick);

    const events: SimEvent[] = [];
    for (const entry of due) {
      const result = this.module.onTimer(this.state, entry.payload, { tick, network: this.network });
      events.push(...this.commit(result, tick));
    }
    return events;
  }

  getCurrentTick(): Tick {
    return this.scheduler.tick;
  }

  getState(): State {
    return this.state;
  }

  getEvents(): readonly SimEvent[] {
    return this.eventLog.all();
  }

  private commit(result: ReduceResult<State>, tick: Tick): SimEvent[] {
    this.state = result.state;

    const stamped = result.events.map((draft) => ({
      ...draft,
      id: `event-${this.nextEventId++}`,
      tick,
    }));
    for (const event of stamped) {
      this.eventLog.append(event);
    }

    for (const request of result.schedule ?? []) {
      this.scheduler.getTimerQueue().schedule(request.dueTick, request.payload);
    }

    return stamped;
  }
}

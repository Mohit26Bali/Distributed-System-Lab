import { TimerQueue } from "../scheduler/TimerQueue";
import type { Tick } from "./types";

/** Owns the tick counter and the pending-timer queue. */
export class Scheduler {
  private currentTick: Tick = 0;
  private timerQueue = new TimerQueue<unknown>();

  get tick(): Tick {
    return this.currentTick;
  }

  advance(): Tick {
    this.currentTick += 1;
    return this.currentTick;
  }

  getTimerQueue(): TimerQueue<unknown> {
    return this.timerQueue;
  }
}

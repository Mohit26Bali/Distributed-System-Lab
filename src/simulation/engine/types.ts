import type { NetworkModel } from "../network/NetworkModel";

export type Tick = number;

export interface SimEvent {
  id: string;
  tick: Tick;
  type: string;
  moduleId: string;
  payload: unknown;
}

/** What a reducer returns before the engine stamps id/tick and commits it. */
export type SimEventDraft = Omit<SimEvent, "id" | "tick">;

export interface ReduceContext {
  tick: Tick;
  network: NetworkModel;
}

/** A reducer's declarative request to run `payload` through onTimer at `dueTick`. */
export interface ScheduleRequest {
  dueTick: Tick;
  payload: unknown;
}

export interface ReduceResult<State> {
  state: State;
  events: SimEventDraft[];
  schedule?: ScheduleRequest[];
}

/**
 * The contract every learning module implements to plug into the generic
 * engine (see docs/04-simulation-engine.md). The engine never imports a
 * concrete module — it only ever calls through this interface.
 */
export interface SimulationModule<State, Action> {
  id: string;
  initialState: State;
  reduce(state: State, action: Action, ctx: ReduceContext): ReduceResult<State>;
  onTimer(state: State, payload: unknown, ctx: ReduceContext): ReduceResult<State>;
}

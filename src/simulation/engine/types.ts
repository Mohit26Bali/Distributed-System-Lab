import type { NetworkModel, NetworkPatch } from "../network/NetworkModel";
import type { SeededRandom } from "../scheduler/SeededRandom";

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
  /** Seeded, deterministic — never Math.random(). See docs/04-simulation-engine.md. */
  random: SeededRandom;
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
  /**
   * A declarative request to mutate the network model (partition, link
   * latency/drop-rate). The engine applies this blindly via
   * network.applyPatch() without interpreting it — same "engine never
   * knows what a module means" boundary as `schedule`.
   */
  networkPatch?: NetworkPatch;
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

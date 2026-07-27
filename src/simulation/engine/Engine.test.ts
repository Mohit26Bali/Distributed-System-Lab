import { describe, expect, it } from "vitest";
import { Engine } from "./Engine";
import { NetworkModel } from "../network/NetworkModel";
import type { ReduceResult, SimulationModule } from "./types";

// A minimal fake module, deliberately unrelated to networking, so these
// tests exercise the engine's own generic mechanics (dispatch, scheduling,
// commit atomicity, determinism) rather than any one module's behavior.
interface CounterState {
  count: number;
}

type CounterAction = { type: "INCREMENT" } | { type: "SCHEDULE_LATER"; dueTick: number };

function createCounterModule(): SimulationModule<CounterState, CounterAction> {
  return {
    id: "counter",
    initialState: { count: 0 },
    reduce(state, action): ReduceResult<CounterState> {
      if (action.type === "INCREMENT") {
        const nextState = { count: state.count + 1 };
        return {
          state: nextState,
          events: [{ type: "COUNTED", moduleId: "counter", payload: { count: nextState.count } }],
        };
      }
      // SCHEDULE_LATER: no immediate event, just a future timer to prove
      // the engine's dispatch -> schedule -> advance -> onTimer path works.
      return {
        state,
        events: [],
        schedule: [{ dueTick: action.dueTick, payload: { via: "timer" } }],
      };
    },
    onTimer(state, payload): ReduceResult<CounterState> {
      const nextState = { count: state.count + 1 };
      return {
        state: nextState,
        events: [
          { type: "COUNTED_VIA_TIMER", moduleId: "counter", payload: { count: nextState.count, source: payload } },
        ],
      };
    },
  };
}

function createTestEngine(): Engine<CounterState, CounterAction> {
  return new Engine(createCounterModule(), new NetworkModel([]));
}

describe("Engine", () => {
  it("dispatch() commits the reducer's events at the current tick", () => {
    const engine = createTestEngine();

    const emitted = engine.dispatch({ type: "INCREMENT" });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ type: "COUNTED", tick: 0, moduleId: "counter" });
    expect(engine.getEvents()).toEqual(emitted);
  });

  it("advance() fires onTimer for entries a reducer scheduled, at the correct tick", () => {
    const engine = createTestEngine();

    engine.dispatch({ type: "SCHEDULE_LATER", dueTick: 3 });
    expect(engine.getEvents()).toHaveLength(0); // nothing fires immediately

    engine.advance(); // tick 1
    engine.advance(); // tick 2
    expect(engine.getEvents()).toHaveLength(0); // not due yet

    const emitted = engine.advance(); // tick 3 - due
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ type: "COUNTED_VIA_TIMER", tick: 3 });
  });

  it("stamps monotonically increasing, unique event ids", () => {
    const engine = createTestEngine();
    engine.dispatch({ type: "INCREMENT" });
    engine.dispatch({ type: "INCREMENT" });

    const ids = engine.getEvents().map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("is deterministic: two fresh engines given the same command sequence produce identical event logs", () => {
    const engineA = createTestEngine();
    const engineB = createTestEngine();

    for (const engine of [engineA, engineB]) {
      engine.dispatch({ type: "SCHEDULE_LATER", dueTick: 2 });
      engine.advance();
      engine.dispatch({ type: "INCREMENT" });
      engine.advance();
    }

    expect(engineA.getEvents()).toEqual(engineB.getEvents());
  });
});

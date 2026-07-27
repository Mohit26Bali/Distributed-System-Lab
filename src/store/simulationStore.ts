import { create } from "zustand";

import { createNetworkingModule } from "@/modules/networking/networkingModule";
import type { NetworkingAction } from "@/modules/networking/networkingReducer";
import { Engine } from "@/simulation/engine/Engine";
import type { SimEvent, Tick } from "@/simulation/engine/types";
import { NetworkModel } from "@/simulation/network/NetworkModel";

interface SimulationState {
  /** The live engine's own tick — only step()/dispatch() ever move this. */
  currentTick: Tick;
  events: readonly SimEvent[];
  /**
   * The tick currently being displayed. Equal to currentTick except while
   * scrubbed via the timeline (Milestone 6) — seeking never touches the
   * live engine, it only changes what's rendered, since every visual is
   * already a pure projection of (events, tick).
   */
  viewTick: Tick;
  /** False right after a seek (snap, no animation); true after step/dispatch. */
  animateTransitions: boolean;
  step: () => void;
  dispatch: (action: NetworkingAction) => void;
  seek: (tick: Tick) => void;
}

// One engine per session for now — there is exactly one simulation on
// screen and no module-switching concept yet (that's Milestone 10's
// moduleRegistry). A factory/registry here would be speculative.
const network = new NetworkModel([
  { id: "a-b", from: "a", to: "b", latencyTicks: 3 },
  { id: "a-c", from: "a", to: "c", latencyTicks: 3 },
  { id: "b-c", from: "b", to: "c", latencyTicks: 3 },
]);

const engine = new Engine(createNetworkingModule(["a", "b", "c"]), network);

export const useSimulationStore = create<SimulationState>((set) => ({
  currentTick: engine.getCurrentTick(),
  events: engine.getEvents(),
  viewTick: engine.getCurrentTick(),
  animateTransitions: true,
  step: () => {
    engine.advance();
    set({
      currentTick: engine.getCurrentTick(),
      events: engine.getEvents(),
      viewTick: engine.getCurrentTick(),
      animateTransitions: true,
    });
  },
  dispatch: (action) => {
    engine.dispatch(action);
    set({
      currentTick: engine.getCurrentTick(),
      events: engine.getEvents(),
      viewTick: engine.getCurrentTick(),
      animateTransitions: true,
    });
  },
  seek: (tick) => {
    set({ viewTick: tick, animateTransitions: false });
  },
}));

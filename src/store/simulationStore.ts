import { create } from "zustand";

import { Engine } from "@/simulation/engine/Engine";
import type { SimEvent, Tick } from "@/simulation/engine/types";

interface SimulationState {
  currentTick: Tick;
  events: readonly SimEvent[];
  step: () => void;
}

// One engine per session for now — there is exactly one simulation on
// screen and no module-switching concept yet (that's Milestone 10's
// moduleRegistry). A factory/registry here would be speculative.
const engine = new Engine();

export const useSimulationStore = create<SimulationState>((set) => ({
  currentTick: engine.getCurrentTick(),
  events: engine.getEvents(),
  step: () => {
    engine.advance();
    set({ currentTick: engine.getCurrentTick(), events: engine.getEvents() });
  },
}));

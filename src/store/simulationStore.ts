import { create } from "zustand";

import { createNetworkingModule } from "@/modules/networking/networkingModule";
import type { NetworkingAction } from "@/modules/networking/networkingReducer";
import { Engine } from "@/simulation/engine/Engine";
import type { SimEvent, Tick } from "@/simulation/engine/types";
import { NetworkModel } from "@/simulation/network/NetworkModel";

export type PlaybackStatus = "playing" | "paused";
export type PlaybackSpeed = 0.5 | 1 | 2;

interface SimulationState {
  /** The live engine's own tick — only stepForward()/dispatch() ever move this. */
  currentTick: Tick;
  events: readonly SimEvent[];
  /**
   * The tick currently being displayed. Equal to currentTick except while
   * scrubbed via the timeline (Milestone 6) — seeking/stepping back never
   * touches the live engine, they only change what's rendered, since every
   * visual is already a pure projection of (events, tick).
   */
  viewTick: Tick;
  /** False right after a seek (snap, no animation); true after a step/play/dispatch. */
  animateTransitions: boolean;
  status: PlaybackStatus;
  speed: PlaybackSpeed;
  dispatch: (action: NetworkingAction) => void;
  seek: (tick: Tick) => void;
  /**
   * Moves the viewpoint one tick forward. If we're behind the live tick
   * (scrubbed into already-committed history), this just moves viewTick —
   * nothing new needs to happen. Only at the live edge does it actually
   * call engine.advance(); the engine never advances on its own.
   */
  stepForward: () => void;
  /** Moves the viewpoint one tick back. Never touches the engine. */
  stepBack: () => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
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

export const useSimulationStore = create<SimulationState>((set, get) => ({
  currentTick: engine.getCurrentTick(),
  events: engine.getEvents(),
  viewTick: engine.getCurrentTick(),
  animateTransitions: true,
  status: "paused",
  speed: 1,

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
    set({ viewTick: Math.max(0, Math.min(tick, get().currentTick)), animateTransitions: false });
  },

  stepForward: () => {
    const { viewTick, currentTick } = get();

    if (viewTick < currentTick) {
      set({ viewTick: viewTick + 1, animateTransitions: true });
      return;
    }

    engine.advance();
    set({
      currentTick: engine.getCurrentTick(),
      events: engine.getEvents(),
      viewTick: engine.getCurrentTick(),
      animateTransitions: true,
    });
  },

  stepBack: () => {
    set({ viewTick: Math.max(0, get().viewTick - 1), animateTransitions: true });
  },

  play: () => {
    set({ status: "playing", viewTick: engine.getCurrentTick(), animateTransitions: true });
  },

  pause: () => set({ status: "paused" }),

  setSpeed: (speed) => set({ speed }),
}));

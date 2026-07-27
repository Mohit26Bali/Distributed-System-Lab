import { create } from "zustand";

import type { NetworkingAction } from "@/modules/networking/networkingReducer";
import type { NetworkingState } from "@/modules/networking/networkingState";
import { Engine } from "@/simulation/engine/Engine";
import type { SimEvent, Tick } from "@/simulation/engine/types";
import { NetworkModel } from "@/simulation/network/NetworkModel";
import { getModuleDefinition } from "./moduleRegistry";
import { useUiStore } from "./uiStore";

export type PlaybackStatus = "playing" | "paused";
export type PlaybackSpeed = 0.5 | 1 | 2;

interface SimulationState {
  /** Which module's engine is currently loaded; null until loadModule() runs. */
  moduleId: string | null;
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
  /** Constructs a fresh engine for the given module, discarding any prior one. */
  loadModule: (moduleId: string) => void;
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

// The live engine lives outside the store's own state (Zustand state should
// only ever be the mirrored, serializable fields) — a plain module-scope
// reference, reassigned wholesale by loadModule(). getEngine() always reads
// the *current* value, so no action closure ever holds a stale reference
// across a module switch.
let engine: Engine<NetworkingState, NetworkingAction> | null = null;

function getEngine(): Engine<NetworkingState, NetworkingAction> {
  if (!engine) {
    throw new Error("No module loaded yet — call loadModule() first.");
  }
  return engine;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  moduleId: null,
  currentTick: 0,
  events: [],
  viewTick: 0,
  animateTransitions: true,
  status: "paused",
  speed: 1,

  loadModule: (moduleId) => {
    const definition = getModuleDefinition(moduleId);
    if (!definition) {
      throw new Error(`Unknown module: "${moduleId}"`);
    }

    engine = new Engine(definition.createModule(), new NetworkModel(definition.links));
    useUiStore.getState().clearSelection();

    set({
      moduleId,
      currentTick: engine.getCurrentTick(),
      events: engine.getEvents(),
      viewTick: engine.getCurrentTick(),
      animateTransitions: true,
      status: "paused",
      speed: 1,
    });
  },

  dispatch: (action) => {
    getEngine().dispatch(action);
    set({
      currentTick: getEngine().getCurrentTick(),
      events: getEngine().getEvents(),
      viewTick: getEngine().getCurrentTick(),
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

    getEngine().advance();
    set({
      currentTick: getEngine().getCurrentTick(),
      events: getEngine().getEvents(),
      viewTick: getEngine().getCurrentTick(),
      animateTransitions: true,
    });
  },

  stepBack: () => {
    set({ viewTick: Math.max(0, get().viewTick - 1), animateTransitions: true });
  },

  play: () => {
    set({ status: "playing", viewTick: getEngine().getCurrentTick(), animateTransitions: true });
  },

  pause: () => set({ status: "paused" }),

  setSpeed: (speed) => set({ speed }),
}));

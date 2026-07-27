import { createNetworkingModule } from "@/modules/networking/networkingModule";
import type { NetworkingAction } from "@/modules/networking/networkingReducer";
import type { NetworkingState } from "@/modules/networking/networkingState";
import type { SimulationModule } from "@/simulation/engine/types";
import type { LinkConfig } from "@/simulation/network/types";
import { NETWORKING_GUIDED_STEPS, type GuidedStepDefinition } from "./guidedSteps";

export interface NodePosition {
  x: number;
  y: number;
}

// Only one real module exists so far (networking), so this stays typed
// concretely against its State/Action rather than a generic/unknown shape —
// that generalization is worth doing once a second, differently-shaped
// module (e.g. Raft) actually needs it.
export interface ModuleDefinition {
  id: string;
  title: string;
  summary: string;
  /** A few short paragraphs — plain strings, not MDX; see docs/09-implementation-roadmap.md. */
  description: string[];
  nodeIds: string[];
  links: LinkConfig[];
  nodePositions: Record<string, NodePosition>;
  createModule: () => SimulationModule<NetworkingState, NetworkingAction>;
  /** Absent (not empty array) means this module has no guided content yet. */
  guidedSteps?: GuidedStepDefinition[];
}

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  introduction: {
    id: "introduction",
    title: "Introduction",
    summary: "Get oriented with the controls on a minimal two-node network.",
    description: [
      "This is the simplest possible simulation: two nodes, one link. Use it to get comfortable with the controls before moving on to a real module.",
      "Send a message, then use the timeline to scrub backward and forward through what happened. Try killing a node or dropping a message to see how faults are recorded as real events, not just visual effects.",
    ],
    nodeIds: ["a", "b"],
    links: [{ id: "a-b", from: "a", to: "b", latencyTicks: 4 }],
    nodePositions: {
      a: { x: 120, y: 160 },
      b: { x: 420, y: 160 },
    },
    createModule: () => createNetworkingModule(["a", "b"]),
  },

  networking: {
    id: "networking",
    title: "Networking",
    summary: "Messages travel over links with real latency — nothing is instantaneous.",
    description: [
      "A network is not a reliable, instant pipe. Every link here has a configured latency: a sent message doesn't arrive until a specific number of ticks later, and you can watch it travel.",
      "Kill a node mid-flight and see the asymmetry: a message already sent by a node that then crashes still arrives, but a message arriving at an already-crashed node is dropped instead.",
    ],
    nodeIds: ["a", "b", "c"],
    links: [
      { id: "a-b", from: "a", to: "b", latencyTicks: 3 },
      { id: "a-c", from: "a", to: "c", latencyTicks: 3 },
      { id: "b-c", from: "b", to: "c", latencyTicks: 3 },
    ],
    nodePositions: {
      a: { x: 80, y: 160 },
      b: { x: 320, y: 40 },
      c: { x: 320, y: 280 },
    },
    createModule: () => createNetworkingModule(["a", "b", "c"]),
    guidedSteps: NETWORKING_GUIDED_STEPS,
  },
};

export function getModuleDefinition(moduleId: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY[moduleId];
}

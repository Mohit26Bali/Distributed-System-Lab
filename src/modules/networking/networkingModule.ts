import type { SimulationModule } from "../../simulation/engine/types";
import { NETWORKING_MODULE_ID } from "./constants";
import { onNetworkingTimer } from "./networkingBehaviors";
import { reduceNetworking, type NetworkingAction } from "./networkingReducer";
import { createInitialNetworkingState, type NetworkingState } from "./networkingState";

export function createNetworkingModule(
  nodeIds: string[],
): SimulationModule<NetworkingState, NetworkingAction> {
  return {
    id: NETWORKING_MODULE_ID,
    initialState: createInitialNetworkingState(nodeIds),
    reduce: reduceNetworking,
    onTimer: onNetworkingTimer,
  };
}

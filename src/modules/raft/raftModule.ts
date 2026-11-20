import type { SimulationModule } from "../../simulation/engine/types";
import { RAFT_MODULE_ID } from "./constants";
import { onRaftTimer } from "./raftBehaviors";
import { reduceRaft, type RaftAction } from "./raftReducer";
import { createInitialRaftState, type RaftState } from "./raftState";

export function createRaftModule(nodeIds: string[]): SimulationModule<RaftState, RaftAction> {
  return {
    id: RAFT_MODULE_ID,
    initialState: createInitialRaftState(nodeIds),
    reduce: reduceRaft,
    onTimer: onRaftTimer,
  };
}

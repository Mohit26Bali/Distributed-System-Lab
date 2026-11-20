import type { SimulationModule } from "../../simulation/engine/types";
import { ELECTION_MODULE_ID } from "./constants";
import { onElectionTimer } from "./electionBehaviors";
import { reduceElection, type ElectionAction } from "./electionReducer";
import { createInitialElectionState, type ElectionState } from "./electionState";

export function createElectionModule(nodeIds: string[]): SimulationModule<ElectionState, ElectionAction> {
  return {
    id: ELECTION_MODULE_ID,
    initialState: createInitialElectionState(nodeIds),
    reduce: reduceElection,
    onTimer: onElectionTimer,
  };
}

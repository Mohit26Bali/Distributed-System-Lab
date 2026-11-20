import type { SimulationModule } from "../../simulation/engine/types";
import { REPLICATION_MODULE_ID } from "./constants";
import { onReplicationTimer } from "./replicationBehaviors";
import { reduceReplication, type ReplicationAction } from "./replicationReducer";
import { createInitialReplicationState, type ReplicationState } from "./replicationState";

export function createReplicationModule(
  leaderId: string,
  followerIds: string[],
): SimulationModule<ReplicationState, ReplicationAction> {
  return {
    id: REPLICATION_MODULE_ID,
    initialState: createInitialReplicationState(leaderId, followerIds),
    reduce: reduceReplication,
    onTimer: onReplicationTimer,
  };
}

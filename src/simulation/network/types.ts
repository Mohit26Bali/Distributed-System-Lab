export interface LinkConfig {
  id: string;
  from: string;
  to: string;
  latencyTicks: number;
  /** Probability [0, 1) that a delivery over this link is randomly lost. Defaults to 0. */
  dropRate?: number;
}

export interface LinkOverride {
  from: string;
  to: string;
  latencyTicks?: number;
  dropRate?: number;
}

/**
 * A declarative request to mutate NetworkModel, returned by a reducer via
 * ReduceResult.networkPatch. `partitionGroups: null` explicitly heals any
 * active partition; `undefined` (omitted) leaves partition state untouched.
 */
export interface NetworkPatch {
  partitionGroups?: string[][] | null;
  linkOverrides?: LinkOverride[];
}

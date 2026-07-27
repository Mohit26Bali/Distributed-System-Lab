import type { LinkConfig, NetworkPatch } from "./types";

function linkKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export type { NetworkPatch };

/** Topology + latency + drop-rate + partition state. */
export class NetworkModel {
  private linksByPair = new Map<string, Required<LinkConfig>>();
  private partitionGroups: string[][] | null = null;

  constructor(links: LinkConfig[]) {
    for (const link of links) {
      this.linksByPair.set(linkKey(link.from, link.to), { ...link, dropRate: link.dropRate ?? 0 });
    }
  }

  private getLink(from: string, to: string): Required<LinkConfig> {
    const link = this.linksByPair.get(linkKey(from, to));
    if (!link) {
      throw new Error(`No link between "${from}" and "${to}"`);
    }
    return link;
  }

  getLatency(from: string, to: string): number {
    return this.getLink(from, to).latencyTicks;
  }

  getDropRate(from: string, to: string): number {
    return this.getLink(from, to).dropRate;
  }

  isPartitioned(from: string, to: string): boolean {
    if (!this.partitionGroups) return false;
    const groupOf = (id: string) => this.partitionGroups!.findIndex((group) => group.includes(id));
    return groupOf(from) !== groupOf(to);
  }

  /** Applied by Engine after a reducer returns a networkPatch — see docs/04-simulation-engine.md. */
  applyPatch(patch: NetworkPatch): void {
    if (patch.partitionGroups !== undefined) {
      this.partitionGroups = patch.partitionGroups;
    }

    for (const override of patch.linkOverrides ?? []) {
      const key = linkKey(override.from, override.to);
      const existing = this.linksByPair.get(key);
      if (!existing) continue;

      this.linksByPair.set(key, {
        ...existing,
        latencyTicks: override.latencyTicks ?? existing.latencyTicks,
        dropRate: override.dropRate ?? existing.dropRate,
      });
    }
  }
}

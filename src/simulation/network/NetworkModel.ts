import type { LinkConfig } from "./types";

function linkKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

/** Topology + latency. No drop/partition modeling yet — see Milestone 9/13. */
export class NetworkModel {
  private linksByPair = new Map<string, LinkConfig>();

  constructor(links: LinkConfig[]) {
    for (const link of links) {
      this.linksByPair.set(linkKey(link.from, link.to), link);
    }
  }

  getLatency(from: string, to: string): number {
    const link = this.linksByPair.get(linkKey(from, to));
    if (!link) {
      throw new Error(`No link between "${from}" and "${to}"`);
    }
    return link.latencyTicks;
  }
}

/**
 * Deterministic PRNG (mulberry32). Not yet consumed by anything in this
 * milestone's trivial tick behavior — it exists now so that no later
 * module ever reaches for `Math.random()`, which would silently break
 * the engine's determinism guarantee (see docs/04-simulation-engine.md).
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

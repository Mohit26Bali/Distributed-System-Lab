import { describe, expect, it } from "vitest";
import { SeededRandom } from "./SeededRandom";

function sequence(seed: number, count: number): number[] {
  const random = new SeededRandom(seed);
  return Array.from({ length: count }, () => random.next());
}

describe("SeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    expect(sequence(42, 10)).toEqual(sequence(42, 10));
  });

  it("produces a different sequence for a different seed", () => {
    expect(sequence(1, 10)).not.toEqual(sequence(2, 10));
  });

  it("always returns values in [0, 1)", () => {
    for (const value of sequence(7, 200)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

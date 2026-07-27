import { describe, expect, it } from "vitest";
import { NETWORKING_CHALLENGES } from "./challenges";
import type { SimEvent } from "@/simulation/engine/types";

function eventOf(type: string, tick = 0): SimEvent {
  return { id: `e-${type}-${tick}-${Math.random()}`, tick, type, moduleId: "networking", payload: {} };
}

function findChallenge(id: string) {
  const challenge = NETWORKING_CHALLENGES.find((c) => c.id === id);
  if (!challenge) throw new Error(`challenge not found: ${id}`);
  return challenge;
}

describe("cause-a-drop challenge", () => {
  const challenge = findChallenge("cause-a-drop");

  it("fails when the log has no MESSAGE_DROPPED event", () => {
    expect(challenge.isComplete([])).toBe(false);
    expect(challenge.isComplete([eventOf("MESSAGE_SENT"), eventOf("MESSAGE_DELIVERED")])).toBe(
      false,
    );
  });

  it("passes when the log has a MESSAGE_DROPPED event", () => {
    expect(challenge.isComplete([eventOf("MESSAGE_DROPPED")])).toBe(true);
  });

  it("passes regardless of what else happened alongside it (any valid path)", () => {
    const events = [
      eventOf("MESSAGE_SENT"),
      eventOf("MESSAGE_DELIVERED"),
      eventOf("NODE_CRASHED"),
      eventOf("MESSAGE_SENT"),
      eventOf("MESSAGE_DROPPED"),
    ];
    expect(challenge.isComplete(events)).toBe(true);
  });

  it("passes even if the drop happened earlier in the session, not just 'just now'", () => {
    // Unlike a guided step, a challenge asks "can you make this true" --
    // an already-achieved fact from earlier still counts.
    const events = [eventOf("MESSAGE_DROPPED", 2), eventOf("MESSAGE_SENT", 5)];
    expect(challenge.isComplete(events)).toBe(true);
  });
});

describe("cause-a-duplicate challenge", () => {
  const challenge = findChallenge("cause-a-duplicate");

  it("fails when the log has no MESSAGE_DUPLICATED event", () => {
    expect(challenge.isComplete([])).toBe(false);
    expect(challenge.isComplete([eventOf("MESSAGE_SENT"), eventOf("MESSAGE_DROPPED")])).toBe(
      false,
    );
  });

  it("passes when the log has a MESSAGE_DUPLICATED event", () => {
    expect(challenge.isComplete([eventOf("MESSAGE_DUPLICATED")])).toBe(true);
  });
});

describe("NETWORKING_CHALLENGES", () => {
  it("every challenge has a unique id", () => {
    const ids = NETWORKING_CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

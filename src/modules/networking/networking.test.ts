import { describe, expect, it } from "vitest";
import { Engine } from "../../simulation/engine/Engine";
import { NetworkModel } from "../../simulation/network/NetworkModel";
import { NETWORK_EVENT_TYPES } from "../../simulation/events/networkEvents";
import { createNetworkingModule } from "./networkingModule";
import type { NetworkingAction } from "./networkingReducer";
import type { NetworkingState } from "./networkingState";

function createTestEngine(latencyTicks = 3): Engine<NetworkingState, NetworkingAction> {
  const network = new NetworkModel([{ id: "a-b", from: "a", to: "b", latencyTicks }]);
  return new Engine(createNetworkingModule(["a", "b"]), network);
}

describe("networking module", () => {
  it("sending a ping produces a MESSAGE_SENT event immediately, with no other side effects", () => {
    const engine = createTestEngine(3);

    const emitted = engine.dispatch({ type: "SEND_PING", from: "a", to: "b" });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: NETWORK_EVENT_TYPES.MESSAGE_SENT,
      tick: 0,
      payload: { messageId: "msg-0", from: "a", to: "b", sentTick: 0, deliveredTick: 3 },
    });
  });

  it("delivers the message exactly N ticks later, not before and not after", () => {
    const engine = createTestEngine(3);
    engine.dispatch({ type: "SEND_PING", from: "a", to: "b" });

    engine.advance(); // tick 1
    engine.advance(); // tick 2
    expect(engine.getEvents().some((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED)).toBe(
      false,
    );

    engine.advance(); // tick 3 - due
    const delivered = engine
      .getEvents()
      .filter((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ tick: 3, payload: { messageId: "msg-0" } });

    engine.advance(); // tick 4 - should not fire again
    expect(
      engine.getEvents().filter((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED),
    ).toHaveLength(1);
  });

  it("assigns distinct message ids to consecutive pings", () => {
    const engine = createTestEngine(1);
    engine.dispatch({ type: "SEND_PING", from: "a", to: "b" });
    engine.dispatch({ type: "SEND_PING", from: "a", to: "b" });

    const sent = engine
      .getEvents()
      .filter((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_SENT)
      .map((e) => (e.payload as { messageId: string }).messageId);
    expect(sent).toEqual(["msg-0", "msg-1"]);
  });

  it("is deterministic: two engines given the same ping + advance sequence produce identical logs", () => {
    const engineA = createTestEngine(3);
    const engineB = createTestEngine(3);

    for (const engine of [engineA, engineB]) {
      engine.dispatch({ type: "SEND_PING", from: "a", to: "b" });
      engine.advance();
      engine.advance();
      engine.advance();
    }

    expect(engineA.getEvents()).toEqual(engineB.getEvents());
  });
});

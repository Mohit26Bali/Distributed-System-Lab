import { describe, expect, it } from "vitest";
import { Engine } from "../../simulation/engine/Engine";
import { NetworkModel } from "../../simulation/network/NetworkModel";
import { NETWORK_EVENT_TYPES } from "../../simulation/events/networkEvents";
import { NODE_EVENT_TYPES } from "../../simulation/events/nodeEvents";
import { createNetworkingModule } from "./networkingModule";
import type { NetworkingAction } from "./networkingReducer";
import type { NetworkingState } from "./networkingState";

function createTestEngine(
  latencyTicks = 3,
  nodeIds = ["a", "b"],
): Engine<NetworkingState, NetworkingAction> {
  const network = new NetworkModel([
    { id: "a-b", from: "a", to: "b", latencyTicks },
    { id: "b-c", from: "b", to: "c", latencyTicks },
    { id: "a-c", from: "a", to: "c", latencyTicks },
  ]);
  return new Engine(createNetworkingModule(nodeIds), network);
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

describe("networking module — fault injection", () => {
  it("killing a node emits NODE_CRASHED and marks it crashed in state", () => {
    const engine = createTestEngine(3, ["a", "b", "c"]);

    const emitted = engine.dispatch({ type: "KILL_NODE", nodeId: "b" });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: NODE_EVENT_TYPES.NODE_CRASHED,
      payload: { nodeId: "b" },
    });
    expect(engine.getState().nodes["b"].status).toBe("crashed");
  });

  it("killing an already-crashed node is rejected: no new event", () => {
    const engine = createTestEngine(3, ["a", "b", "c"]);
    engine.dispatch({ type: "KILL_NODE", nodeId: "b" });

    const secondAttempt = engine.dispatch({ type: "KILL_NODE", nodeId: "b" });
    expect(secondAttempt).toHaveLength(0);
  });

  it("sending a ping from a crashed node is rejected", () => {
    const engine = createTestEngine(3, ["a", "b", "c"]);
    engine.dispatch({ type: "KILL_NODE", nodeId: "a" });

    const emitted = engine.dispatch({ type: "SEND_PING", from: "a", to: "b" });
    expect(emitted).toHaveLength(0);
  });

  it("a message whose destination crashes before delivery is dropped, not delivered, exactly at the delivery tick", () => {
    const engine = createTestEngine(3, ["a", "b", "c"]);
    engine.dispatch({ type: "SEND_PING", from: "a", to: "b" }); // deliveredTick = 3

    engine.advance(); // tick 1
    engine.dispatch({ type: "KILL_NODE", nodeId: "b" }); // destination dies mid-flight
    engine.advance(); // tick 2
    expect(engine.getEvents().some((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED)).toBe(
      false,
    );

    engine.advance(); // tick 3 - the message resolves here
    const droppedEvents = engine
      .getEvents()
      .filter((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED);
    const deliveredEvents = engine
      .getEvents()
      .filter((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED);

    expect(droppedEvents).toHaveLength(1);
    expect(droppedEvents[0]).toMatchObject({ tick: 3, payload: { messageId: "msg-0" } });
    expect(deliveredEvents).toHaveLength(0);
    expect(engine.getState().messages["msg-0"].status).toBe("dropped");
  });

  it("a message already in flight still delivers normally if its SENDER (not destination) crashes", () => {
    const engine = createTestEngine(3, ["a", "b", "c"]);
    engine.dispatch({ type: "SEND_PING", from: "a", to: "b" }); // deliveredTick = 3

    engine.advance(); // tick 1
    engine.dispatch({ type: "KILL_NODE", nodeId: "a" }); // sender dies, message already in the network
    engine.advance(); // tick 2
    engine.advance(); // tick 3 - the message resolves here

    const delivered = engine
      .getEvents()
      .filter((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ tick: 3, payload: { messageId: "msg-0" } });
  });

  it("manually dropping an in-flight message emits MESSAGE_DROPPED and it never delivers, even once its original tick arrives", () => {
    const engine = createTestEngine(3, ["a", "b", "c"]);
    engine.dispatch({ type: "SEND_PING", from: "a", to: "b" }); // deliveredTick = 3
    engine.advance(); // tick 1

    const dropEmitted = engine.dispatch({ type: "DROP_MESSAGE", messageId: "msg-0" });
    expect(dropEmitted).toHaveLength(1);
    expect(dropEmitted[0]).toMatchObject({
      type: NETWORK_EVENT_TYPES.MESSAGE_DROPPED,
      tick: 1,
      payload: { messageId: "msg-0" },
    });

    engine.advance(); // tick 2
    engine.advance(); // tick 3 - the stale scheduled timer fires here and must be a no-op

    const deliveredEvents = engine
      .getEvents()
      .filter((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED);
    const droppedEvents = engine
      .getEvents()
      .filter((e) => e.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED);
    expect(deliveredEvents).toHaveLength(0);
    expect(droppedEvents).toHaveLength(1); // still just the one, manual drop -- the stale timer emitted nothing
    expect(engine.getState().messages["msg-0"].status).toBe("dropped");
  });

  it("dropping a message that has already been delivered is rejected: no new event", () => {
    const engine = createTestEngine(1, ["a", "b", "c"]);
    engine.dispatch({ type: "SEND_PING", from: "a", to: "b" }); // deliveredTick = 1
    engine.advance(); // tick 1 - delivered

    const emitted = engine.dispatch({ type: "DROP_MESSAGE", messageId: "msg-0" });
    expect(emitted).toHaveLength(0);
  });

  it("is deterministic: two engines given the same fault-injection sequence produce identical logs", () => {
    const engineA = createTestEngine(3, ["a", "b", "c"]);
    const engineB = createTestEngine(3, ["a", "b", "c"]);

    for (const engine of [engineA, engineB]) {
      engine.dispatch({ type: "SEND_PING", from: "a", to: "b" });
      engine.advance();
      engine.dispatch({ type: "KILL_NODE", nodeId: "b" });
      engine.advance();
      engine.advance();
    }

    expect(engineA.getEvents()).toEqual(engineB.getEvents());
  });
});

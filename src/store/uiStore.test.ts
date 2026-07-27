import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ selectedNodeId: null, selectedMessageId: null });
  });

  it("selecting a node clears any selected message", () => {
    useUiStore.getState().selectMessage("msg-0");
    useUiStore.getState().selectNode("a");

    expect(useUiStore.getState().selectedNodeId).toBe("a");
    expect(useUiStore.getState().selectedMessageId).toBeNull();
  });

  it("selecting a message clears any selected node", () => {
    useUiStore.getState().selectNode("a");
    useUiStore.getState().selectMessage("msg-0");

    expect(useUiStore.getState().selectedMessageId).toBe("msg-0");
    expect(useUiStore.getState().selectedNodeId).toBeNull();
  });
});

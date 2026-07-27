import { create } from "zustand";

interface UiState {
  selectedNodeId: string | null;
  selectedMessageId: string | null;
  selectNode: (nodeId: string) => void;
  selectMessage: (messageId: string) => void;
  /** Used when switching modules (Milestone 10) — a stale id could otherwise
   * coincidentally resolve against a differently-configured node/message
   * of the same id in the newly loaded module. */
  clearSelection: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  selectedMessageId: null,
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedMessageId: null }),
  selectMessage: (messageId) => set({ selectedMessageId: messageId, selectedNodeId: null }),
  clearSelection: () => set({ selectedNodeId: null, selectedMessageId: null }),
}));

import { create } from "zustand";

interface UiState {
  selectedNodeId: string | null;
  selectedMessageId: string | null;
  selectNode: (nodeId: string) => void;
  selectMessage: (messageId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  selectedMessageId: null,
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedMessageId: null }),
  selectMessage: (messageId) => set({ selectedMessageId: messageId, selectedNodeId: null }),
}));

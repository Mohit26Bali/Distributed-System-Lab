import type { SimEventDraft } from "../engine/types";

export const NODE_EVENT_TYPES = {
  NODE_CRASHED: "NODE_CRASHED",
} as const;

export interface NodeCrashedPayload {
  nodeId: string;
}

export function nodeCrashedEvent(moduleId: string, payload: NodeCrashedPayload): SimEventDraft {
  return { type: NODE_EVENT_TYPES.NODE_CRASHED, moduleId, payload };
}

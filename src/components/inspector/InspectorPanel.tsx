"use client";

import { useMessageDetail } from "@/hooks/useMessageDetail";
import { useSimulationStore } from "@/store/simulationStore";
import { useUiStore } from "@/store/uiStore";

import { EventDetail } from "./EventDetail";
import { NodeInspector } from "./NodeInspector";

export function InspectorPanel() {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectedMessageId = useUiStore((state) => state.selectedMessageId);
  const events = useSimulationStore((state) => state.events);
  const viewTick = useSimulationStore((state) => state.viewTick);

  const messageDetail = useMessageDetail(events, selectedMessageId, viewTick);

  if (selectedNodeId) {
    return <NodeInspector nodeId={selectedNodeId} />;
  }

  if (selectedMessageId) {
    if (!messageDetail) {
      return (
        <p className="text-xs text-text-muted">
          This message has not been sent yet at tick {viewTick}.
        </p>
      );
    }
    return <EventDetail detail={messageDetail} />;
  }

  return <p className="text-xs text-text-muted">Select a node or message to inspect it.</p>;
}

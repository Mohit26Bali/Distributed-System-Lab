"use client";

import { useMessageDetail } from "@/hooks/useMessageDetail";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";
import { useUiStore } from "@/store/uiStore";

import { EventDetail } from "./EventDetail";
import { NodeInspector } from "./NodeInspector";

export function InspectorPanel() {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectedMessageId = useUiStore((state) => state.selectedMessageId);
  const moduleId = useSimulationStore((state) => state.moduleId);
  const events = useSimulationStore((state) => state.events);
  const viewTick = useSimulationStore((state) => state.viewTick);

  const messageDetail = useMessageDetail(events, selectedMessageId, viewTick);
  const nodeStatus = useNodeStatus(events, selectedNodeId, viewTick);
  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;

  if (selectedNodeId) {
    return (
      <NodeInspector
        nodeId={selectedNodeId}
        status={nodeStatus}
        extra={definition?.renderNodeDetail?.(selectedNodeId, events, viewTick)}
      />
    );
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

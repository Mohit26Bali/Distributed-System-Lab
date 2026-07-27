"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { useNodeStatus } from "@/hooks/useNodeStatus";
import { cn } from "@/lib/utils";
import { useSimulationStore } from "@/store/simulationStore";
import { useUiStore } from "@/store/uiStore";

export type NodeGlyphData = {
  label: string;
};

export type NodeGlyphType = Node<NodeGlyphData, "glyph">;

export function NodeGlyph({ id, data }: NodeProps<NodeGlyphType>) {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectNode = useUiStore((state) => state.selectNode);
  const events = useSimulationStore((state) => state.events);
  const viewTick = useSimulationStore((state) => state.viewTick);

  const isSelected = selectedNodeId === id;
  const status = useNodeStatus(events, id, viewTick);
  const isCrashed = status === "crashed";

  return (
    <div
      onClick={() => selectNode(id)}
      className={cn(
        "flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-medium",
        isCrashed
          ? "border-dashed border-red-500 bg-bg-elevated text-text-muted opacity-60"
          : "bg-bg-elevated text-text-primary",
        !isCrashed && (isSelected ? "border-amber-400 ring-2 ring-amber-400/50" : "border-sky-500"),
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";

export type NodeGlyphData = {
  label: string;
};

export type NodeGlyphType = Node<NodeGlyphData, "glyph">;

export function NodeGlyph({ id, data }: NodeProps<NodeGlyphType>) {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectNode = useUiStore((state) => state.selectNode);
  const isSelected = selectedNodeId === id;

  return (
    <div
      onClick={() => selectNode(id)}
      className={cn(
        "flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 bg-bg-elevated text-sm font-medium text-text-primary",
        isSelected ? "border-amber-400 ring-2 ring-amber-400/50" : "border-sky-500",
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

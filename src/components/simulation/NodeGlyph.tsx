import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type NodeGlyphData = {
  label: string;
};

export type NodeGlyphType = Node<NodeGlyphData, "glyph">;

export function NodeGlyph({ data }: NodeProps<NodeGlyphType>) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-sky-500 bg-bg-elevated text-sm font-medium text-text-primary">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

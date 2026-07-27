"use client";

import { Background, Controls, ReactFlow, type EdgeTypes, type NodeTypes } from "@xyflow/react";

import { NodeGlyph, type NodeGlyphType } from "./NodeGlyph";
import { LinkLine, type LinkLineType } from "./LinkLine";

const nodeTypes: NodeTypes = { glyph: NodeGlyph };
const edgeTypes: EdgeTypes = { link: LinkLine };

const nodes: NodeGlyphType[] = [
  { id: "a", type: "glyph", position: { x: 80, y: 160 }, data: { label: "A" } },
  { id: "b", type: "glyph", position: { x: 320, y: 40 }, data: { label: "B" } },
  { id: "c", type: "glyph", position: { x: 320, y: 280 }, data: { label: "C" } },
];

const edges: LinkLineType[] = [
  { id: "a-b", type: "link", source: "a", target: "b" },
  { id: "a-c", type: "link", source: "a", target: "c" },
  { id: "b-c", type: "link", source: "b", target: "c" },
];

export function SimulationCanvas() {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      className="h-full w-full"
    >
      <Background color="var(--border-subtle)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

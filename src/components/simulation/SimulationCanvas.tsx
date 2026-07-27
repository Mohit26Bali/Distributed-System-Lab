"use client";

import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";

import { useSimulationStore } from "@/store/simulationStore";

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
  const currentTick = useSimulationStore((state) => state.currentTick);
  const step = useSimulationStore((state) => state.step);

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
      <Panel
        position="top-left"
        className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm"
      >
        <span className="text-text-secondary">
          Tick: <span className="font-mono text-text-primary">{currentTick}</span>
        </span>
        <button
          type="button"
          onClick={step}
          className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary hover:bg-bg-canvas"
        >
          Advance Tick
        </button>
      </Panel>
    </ReactFlow>
  );
}

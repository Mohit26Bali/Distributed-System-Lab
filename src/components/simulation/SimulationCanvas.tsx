"use client";

import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ViewportPortal,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import { AnimatePresence } from "framer-motion";

import { useEventAnimations } from "@/hooks/useEventAnimations";
import { useSimulationStore } from "@/store/simulationStore";

import { NodeGlyph, type NodeGlyphType } from "./NodeGlyph";
import { LinkLine, type LinkLineType } from "./LinkLine";
import { PacketDot } from "./PacketDot";

const nodeTypes: NodeTypes = { glyph: NodeGlyph };
const edgeTypes: EdgeTypes = { link: LinkLine };

// NodeGlyph renders a 64px circle; its `position` is the top-left corner,
// so the center used for packet placement is offset by half that size.
const NODE_RADIUS = 32;

const nodes: NodeGlyphType[] = [
  { id: "a", type: "glyph", position: { x: 80, y: 160 }, data: { label: "A" } },
  { id: "b", type: "glyph", position: { x: 320, y: 40 }, data: { label: "B" } },
  { id: "c", type: "glyph", position: { x: 320, y: 280 }, data: { label: "C" } },
];

const NODE_CENTERS: Record<string, { x: number; y: number }> = Object.fromEntries(
  nodes.map((node) => [node.id, { x: node.position.x + NODE_RADIUS, y: node.position.y + NODE_RADIUS }]),
);

const edges: LinkLineType[] = [
  { id: "a-b", type: "link", source: "a", target: "b" },
  { id: "a-c", type: "link", source: "a", target: "c" },
  { id: "b-c", type: "link", source: "b", target: "c" },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function SimulationCanvas() {
  const viewTick = useSimulationStore((state) => state.viewTick);
  const events = useSimulationStore((state) => state.events);
  const animateTransitions = useSimulationStore((state) => state.animateTransitions);
  const dispatch = useSimulationStore((state) => state.dispatch);

  // Rendered state always reflects viewTick, not the live currentTick, so
  // scrubbing the timeline (Milestone 6) shows the canvas exactly as it
  // was at that tick — the Timeline panel shows both viewTick and the
  // live tick; playback controls live there too (Milestone 8).
  const { packets } = useEventAnimations(events, viewTick);

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
      <ViewportPortal>
        <AnimatePresence>
          {packets.map((packet) => {
            const source = NODE_CENTERS[packet.from];
            const target = NODE_CENTERS[packet.to];
            return (
              <PacketDot
                key={packet.id}
                id={packet.id}
                x={lerp(source.x, target.x, packet.progress)}
                y={lerp(source.y, target.y, packet.progress)}
                instant={!animateTransitions}
                status={packet.status}
              />
            );
          })}
        </AnimatePresence>
      </ViewportPortal>
      <Panel
        position="top-left"
        className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm"
      >
        <button
          type="button"
          onClick={() => dispatch({ type: "SEND_PING", from: "a", to: "b" })}
          className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary hover:bg-bg-canvas"
        >
          Send Ping A→B
        </button>
      </Panel>
    </ReactFlow>
  );
}

"use client";

import { useMemo } from "react";
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

import { NetworkingControls } from "@/components/controls/NetworkingControls";
import { useEventAnimations } from "@/hooks/useEventAnimations";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";

import { NodeGlyph, type NodeGlyphType } from "./NodeGlyph";
import { LinkLine, type LinkLineType } from "./LinkLine";
import { PacketDot } from "./PacketDot";

const nodeTypes: NodeTypes = { glyph: NodeGlyph };
const edgeTypes: EdgeTypes = { link: LinkLine };

// NodeGlyph renders a 64px circle; a module's registered `nodePositions`
// are top-left corners, so the center used for packet placement is offset
// by half that size.
const NODE_RADIUS = 32;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function SimulationCanvas() {
  const moduleId = useSimulationStore((state) => state.moduleId);
  const viewTick = useSimulationStore((state) => state.viewTick);
  const events = useSimulationStore((state) => state.events);
  const animateTransitions = useSimulationStore((state) => state.animateTransitions);
  const prefersReducedMotion = usePrefersReducedMotion();

  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;

  // Rendered state always reflects viewTick, not the live currentTick, so
  // scrubbing the timeline (Milestone 6) shows the canvas exactly as it
  // was at that tick — the Timeline panel shows both viewTick and the
  // live tick; playback controls live there too (Milestone 8).
  const { packets } = useEventAnimations(events, viewTick);

  const { nodes, edges, nodeCenters } = useMemo(() => {
    if (!definition) return { nodes: [], edges: [], nodeCenters: {} };

    const nodes: NodeGlyphType[] = definition.nodeIds.map((id) => ({
      id,
      type: "glyph",
      position: definition.nodePositions[id],
      data: { label: id.toUpperCase() },
    }));

    const edges: LinkLineType[] = definition.links.map((link) => ({
      id: link.id,
      type: "link",
      source: link.from,
      target: link.to,
    }));

    const nodeCenters: Record<string, { x: number; y: number }> = Object.fromEntries(
      nodes.map((node) => [
        node.id,
        { x: node.position.x + NODE_RADIUS, y: node.position.y + NODE_RADIUS },
      ]),
    );

    return { nodes, edges, nodeCenters };
  }, [definition]);

  if (!definition) {
    // ModuleLoader's effect hasn't run yet -- a brief window, but a plain
    // blank canvas would look broken rather than loading.
    return <p className="p-4 text-xs text-text-muted">Loading module…</p>;
  }

  return (
    <ReactFlow
      // Keyed by module so switching modules remounts the canvas fresh —
      // correct fitView/viewport for the new topology, no stale zoom state.
      key={moduleId}
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
            const source = nodeCenters[packet.from];
            const target = nodeCenters[packet.to];
            return (
              <PacketDot
                key={packet.id}
                id={packet.id}
                x={lerp(source.x, target.x, packet.progress)}
                y={lerp(source.y, target.y, packet.progress)}
                instant={!animateTransitions || prefersReducedMotion}
                status={packet.status}
              />
            );
          })}
        </AnimatePresence>
      </ViewportPortal>
      {/* Networking/Introduction's only real "send a message" trigger — a
          module-specific control, not something every module needs (see
          docs/16-replication-module-design.md's Milestone 31 note). Kept
          as an on-canvas Panel, not moved to ExplanationPane, since
          Networking's own guided step wording ("the button above the
          canvas") depends on where it visually sits. */}
      {(moduleId === "networking" || moduleId === "introduction") && (
        <Panel
          position="top-left"
          className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm"
        >
          <NetworkingControls />
        </Panel>
      )}
      {/* Pressing Play before anything has ever happened otherwise gives
          zero feedback beyond the tick counter moving — nothing wrong is
          happening, but it looks exactly like something is. Only shown
          when the whole session's event log is still empty, so it
          disappears the instant any real action (a write, an election,
          anything) commits its first event, never lingering afterward. */}
      {events.length === 0 && (
        <Panel position="top-center" className="pointer-events-none mt-16">
          <p className="rounded-full border border-border-subtle bg-bg-elevated/90 px-4 py-2 text-xs text-text-muted backdrop-blur-sm">
            Nothing has happened yet — try the guided step in the left panel.
          </p>
        </Panel>
      )}
    </ReactFlow>
  );
}

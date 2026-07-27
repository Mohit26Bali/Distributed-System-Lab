"use client";

import { BaseEdge, getBezierPath, type EdgeProps, type Edge } from "@xyflow/react";

import { useLinkStatus } from "@/hooks/useLinkStatus";
import { useSimulationStore } from "@/store/simulationStore";

export type LinkLineType = Edge<Record<string, never>, "link">;

export function LinkLine({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<LinkLineType>) {
  const events = useSimulationStore((state) => state.events);
  const viewTick = useSimulationStore((state) => state.viewTick);
  const { partitioned } = useLinkStatus(events, source, target, viewTick);

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      path={path}
      style={
        partitioned
          ? { stroke: "var(--color-red-500)", strokeWidth: 2, strokeDasharray: "6 4" }
          : { stroke: "var(--text-muted)", strokeWidth: 2 }
      }
    />
  );
}

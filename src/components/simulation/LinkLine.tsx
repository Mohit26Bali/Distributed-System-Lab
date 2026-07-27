import { BaseEdge, getBezierPath, type EdgeProps, type Edge } from "@xyflow/react";

export type LinkLineType = Edge<Record<string, never>, "link">;

export function LinkLine({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<LinkLineType>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return <BaseEdge path={path} style={{ stroke: "var(--text-muted)", strokeWidth: 2 }} />;
}

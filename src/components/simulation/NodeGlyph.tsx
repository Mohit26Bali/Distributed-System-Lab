"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Crown } from "lucide-react";

import { useNodeCommitIndex } from "@/hooks/useRaftLogSummary";
import { useNodeRole } from "@/hooks/useNodeRole";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { useNodeTerm } from "@/hooks/useNodeTerm";
import { cn } from "@/lib/utils";
import { useSimulationStore } from "@/store/simulationStore";
import { useUiStore } from "@/store/uiStore";

export type NodeGlyphData = {
  label: string;
};

export type NodeGlyphType = Node<NodeGlyphData, "glyph">;

// Replication, Consistency, CAP, and Quorum all share Replication's engine,
// where "leader" is a fixed role from initial state — it never fires a
// NODE_ROLE_CHANGED event (unlike Election/Raft's emergent leadership), so
// useNodeRole alone can never detect it. A static id check is the only way
// to show a crown for these modules at all; found while working through
// this exact redesign, not a pre-existing intentional omission.
const STATIC_LEADER_MODULE_IDS = new Set(["replication", "consistency", "cap", "quorum"]);

export function NodeGlyph({ id, data }: NodeProps<NodeGlyphType>) {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectNode = useUiStore((state) => state.selectNode);
  const events = useSimulationStore((state) => state.events);
  const viewTick = useSimulationStore((state) => state.viewTick);
  const moduleId = useSimulationStore((state) => state.moduleId);

  const isSelected = selectedNodeId === id;
  const status = useNodeStatus(events, id, viewTick);
  const isCrashed = status === "crashed";
  const role = useNodeRole(events, id, viewTick);
  const isStaticLeader = !!moduleId && STATIC_LEADER_MODULE_IDS.has(moduleId) && id === "leader";
  const isLeader = !isCrashed && (role === "leader" || isStaticLeader);
  const isCandidate = !isCrashed && role === "candidate";
  // Only Raft ever emits TERM_CHANGED/LOG_ENTRY_COMMITTED — both stay 0/-1
  // (and the badge stays hidden) for every other module, per
  // docs/12-raft-module-design.md.
  const term = useNodeTerm(events, id, viewTick);
  const commitIndex = useNodeCommitIndex(events, id, viewTick);
  // Built from the same isLeader/isCandidate booleans the visuals use
  // (not the raw event-derived `role` alone) so a screen reader announces
  // a static-leader module's leader the same way the crown shows it.
  const roleLabel = isLeader ? "leader" : isCandidate ? "candidate" : null;
  const ariaLabel = [
    `Node ${data.label}`,
    status,
    roleLabel,
    term > 0 ? `term ${term}` : null,
    commitIndex >= 0 ? `commit index ${commitIndex}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      onClick={() => selectNode(id)}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectNode(id);
        }
      }}
      className={cn(
        // Squircle, not a circle — the interaction model (select, hover,
        // handles) is identical everywhere, so every module keeps the same
        // primitive; modules differentiate through badges/topology/color
        // instead of each getting its own shape.
        "relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-2xl border-2 text-sm font-medium outline-2 outline-offset-2 outline-transparent focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-bg-canvas",
        isCrashed
          ? "border-dashed border-red-500 bg-bg-elevated text-text-muted opacity-60"
          : "bg-bg-elevated text-text-primary",
        isLeader && "border-amber-400 ring-2 ring-amber-400/50",
        isCandidate && "border-dashed border-sky-400 animate-pulse motion-reduce:animate-none",
        !isCrashed && !isLeader && !isCandidate && "border-sky-500",
        // Selection is its own visual concern, independent of role/status —
        // an `outline` rather than `ring` so it never collides with the
        // leader ring above (both a node's role AND its selection state
        // must always be visible at once, never one hiding the other).
        isSelected && "outline-white",
      )}
    >
      {isLeader && (
        <Crown
          size={14}
          className="absolute -top-2 text-amber-400"
          aria-hidden="true"
        />
      )}
      {term > 0 && (
        <span
          aria-hidden="true"
          className="absolute -bottom-2 rounded-full bg-bg-panel px-1.5 text-[10px] font-mono text-text-secondary"
        >
          t{term}
          {commitIndex >= 0 && `·c${commitIndex}`}
        </span>
      )}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

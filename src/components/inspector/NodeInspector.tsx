import { cn } from "@/lib/utils";
import type { NodeStatus } from "@/hooks/useNodeStatus";

interface NodeInspectorProps {
  nodeId: string;
  status: NodeStatus;
}

export function NodeInspector({ nodeId, status }: NodeInspectorProps) {
  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-medium text-text-primary">Node {nodeId.toUpperCase()}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-text-muted">Status</dt>
        <dd className={cn("font-mono", status === "crashed" ? "text-red-400" : "text-text-primary")}>
          {status}
        </dd>
      </dl>
    </div>
  );
}

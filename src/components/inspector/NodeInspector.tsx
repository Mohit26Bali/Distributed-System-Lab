interface NodeInspectorProps {
  nodeId: string;
}

// Node status is currently tick-invariant — only "alive" exists until
// Milestone 9 gives the engine a truthful NODE_CRASHED event. When that
// lands, this becomes an event-derived projection like EventDetail's
// message status already is; there's nothing to derive yet.
export function NodeInspector({ nodeId }: NodeInspectorProps) {
  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-medium text-text-primary">Node {nodeId.toUpperCase()}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-text-muted">Status</dt>
        <dd className="font-mono text-text-primary">alive</dd>
      </dl>
    </div>
  );
}

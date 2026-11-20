import type { MessageDetail } from "@/hooks/useMessageDetail";

interface EventDetailProps {
  detail: MessageDetail;
}

export function EventDetail({ detail }: EventDetailProps) {
  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-medium text-text-primary">Message {detail.messageId}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-text-muted">From</dt>
        <dd className="font-mono text-text-primary">{detail.from}</dd>

        <dt className="text-text-muted">To</dt>
        <dd className="font-mono text-text-primary">{detail.to}</dd>

        <dt className="text-text-muted">Sent tick</dt>
        <dd className="font-mono text-text-primary">{detail.sentTick}</dd>

        <dt className="text-text-muted">Delivered tick</dt>
        <dd className="font-mono text-text-primary">{detail.deliveredTick}</dd>

        <dt className="text-text-muted">Status</dt>
        <dd className="font-mono text-text-primary">{detail.status}</dd>

        {detail.kind && (
          <>
            <dt className="text-text-muted">Kind</dt>
            <dd className="font-mono text-text-primary">{detail.kind}</dd>
          </>
        )}

        {detail.dropReason && (
          <>
            <dt className="text-text-muted">Reason</dt>
            <dd className="font-mono text-red-400">{detail.dropReason}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

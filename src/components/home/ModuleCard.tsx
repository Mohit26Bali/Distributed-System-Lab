import Link from "next/link";
import { ArrowRight, Crown, Database, X } from "lucide-react";
import type { CSSProperties, JSX } from "react";

import { LANDING_MODULE_META } from "@/app/landingModuleMeta";

function IntroductionPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-3 w-3 rounded-full" style={{ background: color }} />
      <div className="h-px w-4" style={{ background: color, opacity: 0.4 }} />
      <div className="h-3 w-3 rounded-full border" style={{ borderColor: color }} />
    </div>
  );
}

function NetworkingPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-3 w-3 rounded-full" style={{ background: color }} />
      <div className="h-px w-3" style={{ background: color, opacity: 0.4 }} />
      <div className="h-3 w-3 rounded-full" style={{ background: color }} />
      <div className="h-px w-3 border-t border-dashed" style={{ borderColor: color }} />
      <div className="h-3 w-3 rounded-full" style={{ background: color, opacity: 0.3 }} />
    </div>
  );
}

function ReplicationPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-4 w-4 rounded-full" style={{ background: color }} />
      <div className="flex flex-col gap-0.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-2 w-2 rounded-full" style={{ background: color, opacity: 0.5 }} />
        ))}
      </div>
    </div>
  );
}

function ConsistencyPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[8px]">
      <span className="rounded px-1 py-0.5" style={{ background: `${color}26`, color, border: `1px solid ${color}55` }}>
        x=2
      </span>
      <span className="rounded border border-dashed border-border-subtle px-1 py-0.5 text-text-muted">x=1</span>
    </div>
  );
}

function CapPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[8px]">
      <span
        className="rounded-full px-1.5 py-0.5"
        style={{ background: `${color}26`, color, border: `1px solid ${color}80` }}
      >
        stale
      </span>
      <span className="rounded-full border border-dashed border-border-subtle px-1.5 py-0.5 text-text-muted">
        refuse
      </span>
    </div>
  );
}

function QuorumPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-3 w-3 rounded-full"
          style={{ background: i < 3 ? color : "transparent", border: `1px solid ${color}`, opacity: i < 3 ? 1 : 0.35 }}
        />
      ))}
    </div>
  );
}

function ElectionPreview({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-1">
      <div className="h-3 w-3 rounded-full" style={{ background: color, opacity: 0.4 }} />
      <div className="h-3 w-3 rounded-full" style={{ background: color, opacity: 0.4 }} />
      <div className="relative h-3 w-3 rounded-full" style={{ background: color }}>
        <Crown size={9} className="absolute -top-2.5 left-1/2 -translate-x-1/2" style={{ color }} />
      </div>
    </div>
  );
}

function RaftPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Crown size={13} style={{ color }} />
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-3 w-2 rounded-sm" style={{ background: color, opacity: 1 - i * 0.25 }} />
        ))}
      </div>
    </div>
  );
}

function FaultInjectionPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="relative h-3 w-3 rounded-full" style={{ background: color, opacity: 0.3 }}>
        <X size={9} className="absolute -top-1.5 -right-1.5" style={{ color }} />
      </div>
      <div className="h-px w-3" style={{ background: color, opacity: 0.4 }} />
      <div className="h-3 w-3 rounded-full" style={{ background: color }} />
      <div className="h-px w-3" style={{ background: color, opacity: 0.4 }} />
      <div className="h-3 w-3 rounded-full" style={{ background: color }} />
    </div>
  );
}

function DistributedDatabasePreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Database size={15} style={{ color }} />
      <span className="rounded px-1 py-0.5 font-mono text-[8px]" style={{ background: `${color}26`, color, border: `1px solid ${color}55` }}>
        x=1
      </span>
    </div>
  );
}

const PREVIEWS: Record<string, (props: { color: string }) => JSX.Element> = {
  introduction: IntroductionPreview,
  networking: NetworkingPreview,
  replication: ReplicationPreview,
  consistency: ConsistencyPreview,
  cap: CapPreview,
  quorum: QuorumPreview,
  election: ElectionPreview,
  raft: RaftPreview,
  "fault-injection": FaultInjectionPreview,
  "distributed-database": DistributedDatabasePreview,
};

export function ModuleCard({ id, title, summary }: { id: string; title: string; summary: string }) {
  const meta = LANDING_MODULE_META[id];
  if (!meta) return null;
  const { icon: Icon, color, difficulty, minutes } = meta;
  const Preview = PREVIEWS[id];

  return (
    <Link
      href={`/modules/${id}`}
      style={{ "--accent": color } as CSSProperties}
      className="glass group flex h-full flex-col gap-4 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent)]/40 hover:shadow-[0_8px_30px_-8px_var(--accent)]"
    >
      <div className="flex items-center justify-between">
        <Icon size={18} style={{ color }} className="transition duration-200 group-hover:rotate-6" />
        <ArrowRight
          size={16}
          className="text-text-muted transition group-hover:translate-x-0.5 group-hover:text-[color:var(--accent)]"
        />
      </div>
      {Preview && <Preview color={color} />}
      <div>
        <h3 className="font-medium text-text-primary">{title}</h3>
        <p className="mt-1 text-sm text-text-muted">{summary}</p>
      </div>
      <div className="mt-auto flex items-center gap-3 text-[11px] text-text-muted">
        <span className="rounded-full border border-border-subtle px-2 py-0.5">{difficulty}</span>
        <span>{minutes} min</span>
      </div>
    </Link>
  );
}

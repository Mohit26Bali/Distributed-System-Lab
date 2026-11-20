"use client";

import type { JSX } from "react";

import { ConsistencyControls } from "@/components/controls/ConsistencyControls";
import { DatabaseControls } from "@/components/controls/DatabaseControls";
import { ElectionControls } from "@/components/controls/ElectionControls";
import { NetworkConfigPanel } from "@/components/controls/NetworkConfigPanel";
import { QuorumControls } from "@/components/controls/QuorumControls";
import { RaftControls } from "@/components/controls/RaftControls";
import { ReplicationControls } from "@/components/controls/ReplicationControls";
import { ExplainThisTick } from "@/components/ai/ExplainThisTick";
import { CapTheory } from "@/components/theory/CapTheory";
import { ConsistencyTheory } from "@/components/theory/ConsistencyTheory";
import { DistributedDatabaseTheory } from "@/components/theory/DistributedDatabaseTheory";
import { ElectionTheory } from "@/components/theory/ElectionTheory";
import { FaultInjectionTheory } from "@/components/theory/FaultInjectionTheory";
import { IntroductionTheory } from "@/components/theory/IntroductionTheory";
import { NetworkingTheory } from "@/components/theory/NetworkingTheory";
import { QuorumTheory } from "@/components/theory/QuorumTheory";
import { RaftTheory } from "@/components/theory/RaftTheory";
import { ReplicationTheory } from "@/components/theory/ReplicationTheory";
import { getModuleDefinition } from "@/store/moduleRegistry";
import { useSimulationStore } from "@/store/simulationStore";

import { Challenge } from "./Challenge";
import { GuidedStep } from "./GuidedStep";
import { Quiz } from "./Quiz";

// Keyed by moduleId, same pattern as *Controls — every module now has a
// Theory doc.
const THEORY_BY_MODULE: Record<string, () => JSX.Element> = {
  introduction: IntroductionTheory,
  networking: NetworkingTheory,
  replication: ReplicationTheory,
  consistency: ConsistencyTheory,
  cap: CapTheory,
  quorum: QuorumTheory,
  election: ElectionTheory,
  raft: RaftTheory,
  "fault-injection": FaultInjectionTheory,
  "distributed-database": DistributedDatabaseTheory,
};

export function ExplanationPane() {
  const moduleId = useSimulationStore((state) => state.moduleId);
  const events = useSimulationStore((state) => state.events);
  const viewTick = useSimulationStore((state) => state.viewTick);
  const definition = moduleId ? getModuleDefinition(moduleId) : undefined;

  if (!definition || !moduleId) {
    return <p className="text-xs text-text-muted">Loading module…</p>;
  }

  const Theory = THEORY_BY_MODULE[moduleId];
  const eventsThisTick = events
    .filter((e) => e.tick === viewTick)
    .map((e) => ({ type: e.type, payload: e.payload }));
  const recentEvents = events
    .filter((e) => e.tick < viewTick)
    .slice(-8)
    .reverse()
    .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-text-secondary">{definition.title}</h2>
          {Theory && <Theory />}
        </div>
        {definition.description.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-text-muted">
            {paragraph}
          </p>
        ))}
      </div>
      <ExplainThisTick
        key={`${moduleId}-${viewTick}`}
        request={{ moduleId, tick: viewTick, eventsThisTick, recentEvents }}
      />
      <NetworkConfigPanel key={`${moduleId}-network-config`} />
      {moduleId === "election" && <ElectionControls />}
      {(moduleId === "raft" || moduleId === "fault-injection" || moduleId === "distributed-database") && (
        <RaftControls />
      )}
      {moduleId === "replication" && <ReplicationControls />}
      {(moduleId === "consistency" || moduleId === "cap") && <ConsistencyControls />}
      {moduleId === "quorum" && <QuorumControls />}
      {moduleId === "distributed-database" && <DatabaseControls />}
      {/* Keyed by moduleId so switching modules resets guided/quiz progress
          instead of carrying stale state into a different module. */}
      <GuidedStep key={moduleId} />
      {definition.quizzes?.map((quiz) => (
        <Quiz key={`${moduleId}-${quiz.id}`} quiz={quiz} />
      ))}
      {definition.challenges?.map((challenge) => (
        <Challenge key={challenge.id} challenge={challenge} />
      ))}
    </div>
  );
}

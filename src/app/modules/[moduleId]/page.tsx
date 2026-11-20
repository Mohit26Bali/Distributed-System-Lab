import Link from "next/link";
import { notFound } from "next/navigation";

import { FaultInjectionMenu } from "@/components/controls/FaultInjectionMenu";
import { ExplanationPane } from "@/components/learning/ExplanationPane";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { ModuleLoader } from "@/components/simulation/ModuleLoader";
import { SimulationCanvas } from "@/components/simulation/SimulationCanvas";
import { Timeline } from "@/components/timeline/Timeline";
import { getModuleDefinition } from "@/store/moduleRegistry";

type ModulePageProps = {
  params: Promise<{ moduleId: string }>;
};

export default async function ModulePage({ params }: ModulePageProps) {
  const { moduleId } = await params;

  if (!getModuleDefinition(moduleId)) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <ModuleLoader moduleId={moduleId} />

      <nav aria-label="Lab" className="flex h-9 shrink-0 items-center border-b border-border-subtle bg-bg-canvas px-4">
        <Link href="/" className="readout text-[11px] text-text-secondary transition hover:text-sky-400">
          ← Distributed Systems Lab
        </Link>
      </nav>

      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <aside className="max-lg:order-2 w-full overflow-y-auto border-t border-border-subtle bg-bg-panel p-4 lg:w-70 lg:shrink-0 lg:border-t-0 lg:border-r">
          <ExplanationPane />
        </aside>

        <main className="max-lg:order-1 h-[65vh] min-h-80 overflow-hidden bg-bg-canvas lg:h-auto lg:flex-1">
          <SimulationCanvas />
        </main>

        <aside className="max-lg:order-3 w-full overflow-y-auto border-t border-border-subtle bg-bg-panel p-4 lg:w-80 lg:shrink-0 lg:border-t-0 lg:border-l">
          <InspectorPanel />
        </aside>
      </div>

      <footer className="sticky bottom-0 z-30 flex min-h-30 shrink-0 flex-wrap items-center gap-4 border-t border-border-subtle bg-bg-panel p-4 lg:static">
        <div className="min-w-60 flex-1">
          <Timeline />
        </div>
        <FaultInjectionMenu />
      </footer>
    </div>
  );
}

import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { SimulationCanvas } from "@/components/simulation/SimulationCanvas";
import { Timeline } from "@/components/timeline/Timeline";

type ModulePageProps = {
  params: Promise<{ moduleId: string }>;
};

export default async function ModulePage({ params }: ModulePageProps) {
  const { moduleId } = await params;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border-subtle bg-bg-panel p-4">
          <h2 className="text-sm font-medium text-text-secondary">Learning panel</h2>
          <p className="mt-2 text-sm text-text-muted">
            Module: <span className="font-mono text-text-primary">{moduleId}</span>
          </p>
        </aside>

        <main className="flex-1 overflow-hidden bg-bg-canvas">
          <SimulationCanvas />
        </main>

        <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-border-subtle bg-bg-panel p-4">
          <InspectorPanel />
        </aside>
      </div>

      <footer className="h-[120px] shrink-0 border-t border-border-subtle bg-bg-panel p-4">
        <Timeline />
      </footer>
    </div>
  );
}

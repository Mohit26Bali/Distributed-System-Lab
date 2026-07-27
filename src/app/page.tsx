import Link from "next/link";

import { MODULE_REGISTRY } from "@/store/moduleRegistry";

export default function Home() {
  const modules = Object.values(MODULE_REGISTRY);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg-canvas p-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-text-primary">Distributed Systems Lab</h1>
        <p className="mt-2 text-sm text-text-muted">Choose a module to begin.</p>
      </div>

      <ul className="flex w-full max-w-md flex-col gap-3">
        {modules.map((module) => (
          <li key={module.id}>
            <Link
              href={`/modules/${module.id}`}
              className="block rounded-md border border-border-subtle bg-bg-elevated px-4 py-3 hover:bg-bg-panel"
            >
              <span className="text-sm font-medium text-text-primary">{module.title}</span>
              <p className="mt-1 text-xs text-text-muted">{module.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

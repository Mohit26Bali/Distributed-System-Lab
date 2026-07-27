"use client";

import { useEffect } from "react";

import { useSimulationStore } from "@/store/simulationStore";

interface ModuleLoaderProps {
  moduleId: string;
}

/**
 * Constructs a fresh engine for `moduleId` on mount and whenever it changes.
 * Renders nothing — it exists purely because page.tsx is a server component
 * and can't call a Zustand action itself (same constraint as Milestone 4).
 */
export function ModuleLoader({ moduleId }: ModuleLoaderProps) {
  const loadModule = useSimulationStore((state) => state.loadModule);

  useEffect(() => {
    loadModule(moduleId);
  }, [moduleId, loadModule]);

  return null;
}

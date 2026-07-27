import { useEffect } from "react";

import { useSimulationStore } from "@/store/simulationStore";

// Purely an orchestration-layer cadence — the engine has no concept of
// wall-clock time, only ticks (see docs/06-animation-system.md). This
// interval only ever calls the store's own stepForward(), the identical
// path a manual click uses; the engine cannot tell the difference between
// a human clicking and a timer firing.
const BASE_INTERVAL_MS = 800;

export function useSimulationPlayback(): void {
  const status = useSimulationStore((state) => state.status);
  const speed = useSimulationStore((state) => state.speed);
  const stepForward = useSimulationStore((state) => state.stepForward);

  useEffect(() => {
    if (status !== "playing") return;

    const intervalMs = BASE_INTERVAL_MS / speed;
    const id = setInterval(stepForward, intervalMs);
    return () => clearInterval(id);
  }, [status, speed, stepForward]);
}

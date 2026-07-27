"use client";

import { cn } from "@/lib/utils";
import { useSimulationStore, type PlaybackSpeed } from "@/store/simulationStore";

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2];

export function SpeedControl() {
  const speed = useSimulationStore((state) => state.speed);
  const setSpeed = useSimulationStore((state) => state.setSpeed);

  return (
    <div className="flex items-center gap-1">
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setSpeed(s)}
          aria-pressed={speed === s}
          className={cn(
            "rounded border border-border-subtle px-2 py-1 text-xs font-mono",
            speed === s
              ? "bg-sky-500 text-white"
              : "bg-bg-panel text-text-primary hover:bg-bg-canvas",
          )}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}

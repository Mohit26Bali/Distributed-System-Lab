"use client";

import { useEffect } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { useSimulationPlayback } from "@/hooks/useSimulationPlayback";
import { useSimulationStore } from "@/store/simulationStore";

import { SpeedControl } from "./SpeedControl";

const ICON_BUTTON_CLASS =
  "rounded border border-border-subtle bg-bg-panel p-1.5 text-text-primary hover:bg-bg-canvas disabled:opacity-40";

export function PlaybackControls() {
  const status = useSimulationStore((state) => state.status);
  const play = useSimulationStore((state) => state.play);
  const pause = useSimulationStore((state) => state.pause);
  const stepForward = useSimulationStore((state) => state.stepForward);
  const stepBack = useSimulationStore((state) => state.stepBack);

  // Drives the actual autoplay interval — only mounted/active while this
  // component is on screen, per the "engine only advances on request" rule.
  useSimulationPlayback();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (status === "playing") pause();
        else play();
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        stepForward();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        stepBack();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, play, pause, stepForward, stepBack]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={stepBack}
        aria-label="Step back"
        className={ICON_BUTTON_CLASS}
      >
        <SkipBack size={16} />
      </button>

      <button
        type="button"
        onClick={() => (status === "playing" ? pause() : play())}
        aria-label={status === "playing" ? "Pause" : "Play"}
        className={ICON_BUTTON_CLASS}
      >
        {status === "playing" ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <button
        type="button"
        onClick={stepForward}
        aria-label="Step forward"
        className={ICON_BUTTON_CLASS}
      >
        <SkipForward size={16} />
      </button>

      <SpeedControl />
    </div>
  );
}

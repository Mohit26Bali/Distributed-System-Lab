"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";

// Purely a rendering-layer constant — the engine has no concept of
// milliseconds, only ticks. See docs/06-animation-system.md.
const TICK_TRANSITION_SECONDS = 0.35;

interface PacketDotProps {
  id: string;
  x: number;
  y: number;
  /** True right after a timeline seek: snap instantly, never tween. */
  instant?: boolean;
}

export function PacketDot({ id, x, y, instant }: PacketDotProps) {
  const selectedMessageId = useUiStore((state) => state.selectedMessageId);
  const selectMessage = useUiStore((state) => state.selectMessage);
  const isSelected = selectedMessageId === id;

  return (
    <motion.div
      onClick={() => selectMessage(id)}
      className={cn(
        "pointer-events-auto absolute h-3 w-3 cursor-pointer rounded-full",
        isSelected
          ? "bg-amber-400 shadow-[0_0_8px_3px_rgba(251,191,36,0.7)]"
          : "bg-sky-400 shadow-[0_0_6px_2px_rgba(56,189,248,0.6)]",
      )}
      style={{ left: 0, top: 0 }}
      animate={{ x: x - 6, y: y - 6 }}
      transition={{ duration: instant ? 0 : TICK_TRANSITION_SECONDS, ease: "linear" }}
    />
  );
}

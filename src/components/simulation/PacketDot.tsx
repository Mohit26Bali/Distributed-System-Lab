"use client";

import { motion } from "framer-motion";

// Purely a rendering-layer constant — the engine has no concept of
// milliseconds, only ticks. See docs/06-animation-system.md.
const TICK_TRANSITION_SECONDS = 0.35;

interface PacketDotProps {
  x: number;
  y: number;
  /** True right after a timeline seek: snap instantly, never tween. */
  instant?: boolean;
}

export function PacketDot({ x, y, instant }: PacketDotProps) {
  return (
    <motion.div
      className="pointer-events-none absolute h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_6px_2px_rgba(56,189,248,0.6)]"
      style={{ left: 0, top: 0 }}
      animate={{ x: x - 6, y: y - 6 }}
      transition={{ duration: instant ? 0 : TICK_TRANSITION_SECONDS, ease: "linear" }}
    />
  );
}

"use client";

interface EventMarkerProps {
  tick: number;
  maxTick: number;
  eventCount: number;
  onSeek: (tick: number) => void;
}

export function EventMarker({ tick, maxTick, eventCount, onSeek }: EventMarkerProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSeek(tick);
      }}
      title={`Tick ${tick}: ${eventCount} event${eventCount === 1 ? "" : "s"}`}
      className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 transition-transform hover:scale-125 motion-reduce:transition-none motion-reduce:hover:scale-100"
      style={{ left: `${(tick / maxTick) * 100}%` }}
    />
  );
}

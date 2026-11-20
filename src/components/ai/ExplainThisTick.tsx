"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import type { ExplainTickRequest } from "@/lib/ai/explainTick";

export function ExplainThisTick({ request }: { request: ExplainTickRequest }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleExplain() {
    setLoading(true);
    setError(null);
    setText(null);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setText(data.text);
      }
    } catch {
      setError("Could not reach the AI Tutor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleExplain}
        disabled={loading}
        aria-busy={loading}
        className="glow-accent flex w-fit items-center gap-2 rounded-md bg-purple-400/15 px-3 py-1.5 text-xs font-medium text-purple-400 transition hover:bg-purple-400/25 disabled:opacity-50"
        style={{ "--accent": "#ff6ad5" } as CSSProperties}
      >
        <Sparkles size={14} />
        {loading ? "Thinking…" : "Explain this tick"}
      </button>
      {/* Both the answer and any error land in the same polite live region,
       * so a screen-reader user isn't left waiting with no notification
       * once the async response actually arrives. */}
      <div aria-live="polite" aria-atomic="true">
        {error && <p className="text-xs text-red-400">{error}</p>}
        {text && <div className="glass p-3 text-xs leading-relaxed text-text-primary">{text}</div>}
      </div>
    </div>
  );
}

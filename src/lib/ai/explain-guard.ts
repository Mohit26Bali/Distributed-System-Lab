// Input validation and rate limiting for the optional AI "Explain this tick" route.
// Pure functions (no Next.js imports) so they are easy to test.

import type { ExplainTickRequest } from "./explainTick";

export const LIMITS = {
  moduleId: 40,
  tick: 10_000_000,
  eventsThisTick: 40,
  recentEvents: 30,
  eventType: 60,
  body: 48 * 1024,
} as const;

export type ParseResult = { ok: true; value: ExplainTickRequest } | { ok: false; error: string };

// strips control characters (keeps nothing that could disturb the prompt layout)
function clean(v: string, max: number): string {
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseEvent(v: unknown): { type: string; payload: unknown } | null {
  if (!isObject(v) || typeof v.type !== "string") return null;
  const type = clean(v.type, LIMITS.eventType);
  return type ? { type, payload: v.payload } : null;
}

export function parseExplainRequest(body: unknown): ParseResult {
  if (!isObject(body)) return { ok: false, error: "Body must be a JSON object" };

  if (typeof body.moduleId !== "string" || !/^[a-z0-9-]{1,40}$/.test(body.moduleId)) {
    return { ok: false, error: "moduleId is required (lowercase letters, digits and dashes)" };
  }
  const tick = body.tick;
  if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0 || tick > LIMITS.tick) {
    return { ok: false, error: "tick must be a whole number" };
  }
  if (!Array.isArray(body.eventsThisTick) || !Array.isArray(body.recentEvents)) {
    return { ok: false, error: "eventsThisTick and recentEvents must be lists" };
  }

  const eventsThisTick: ExplainTickRequest["eventsThisTick"] = [];
  for (const e of body.eventsThisTick.slice(0, LIMITS.eventsThisTick)) {
    const p = parseEvent(e);
    if (!p) return { ok: false, error: "Each event needs a text type" };
    eventsThisTick.push(p);
  }
  const recentEvents: ExplainTickRequest["recentEvents"] = [];
  for (const e of body.recentEvents.slice(0, LIMITS.recentEvents)) {
    const p = parseEvent(e);
    const t = isObject(e) ? e.tick : undefined;
    if (!p || typeof t !== "number" || !Number.isInteger(t) || t < 0) {
      return { ok: false, error: "Each recent event needs a type and a whole-number tick" };
    }
    recentEvents.push({ tick: t, ...p });
  }
  return { ok: true, value: { moduleId: body.moduleId, tick, eventsThisTick, recentEvents } };
}

/** Fixed-window counter per key. Memory is bounded: old windows are swept. */
export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();
  constructor(
    private max: number,
    private windowMs: number,
    private maxKeys = 5000,
  ) {}

  /** Returns 0 when allowed, otherwise the seconds to wait. */
  check(key: string, now = Date.now()): number {
    if (this.hits.size >= this.maxKeys) {
      for (const [k, v] of this.hits) if (now - v.start >= this.windowMs) this.hits.delete(k);
      if (this.hits.size >= this.maxKeys) this.hits.clear();
    }
    const cur = this.hits.get(key);
    if (!cur || now - cur.start >= this.windowMs) {
      this.hits.set(key, { start: now, count: 1 });
      return 0;
    }
    if (cur.count >= this.max) return Math.max(1, Math.ceil((cur.start + this.windowMs - now) / 1000));
    cur.count += 1;
    return 0;
  }
}

/**
 * Client address from X-Forwarded-For, trusting only `hops` proxies in front of the app
 * (0 = ignore the header entirely, as when the server is exposed directly).
 */
export function clientKey(forwardedFor: string | null, hops: number): string {
  if (hops <= 0 || !forwardedFor) return "direct";
  const parts = forwardedFor
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "direct";
  const idx = Math.max(0, parts.length - hops);
  return parts[idx].slice(0, 64);
}

import { NextResponse, type NextRequest } from "next/server";
import Groq from "groq-sdk";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/explainTick";
import { LIMITS, RateLimiter, clientKey, parseExplainRequest } from "@/lib/ai/explain-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const perClient = new RateLimiter(intEnv("EXPLAIN_RATE_PER_MIN", 12), 60_000);
const everyone = new RateLimiter(intEnv("EXPLAIN_GLOBAL_PER_MIN", 120), 60_000);

function fail(status: number, error: string, extra: Record<string, string> = {}) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return fail(501, "GROQ_API_KEY is not set. Add it to .env.local and restart the dev server.");

  // Same-origin only: the tutor button calls this from our own pages.
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return fail(403, "Cross-origin requests are not allowed.");

  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return fail(415, "Send application/json.");
  }
  if (Number(req.headers.get("content-length") ?? "0") > LIMITS.body) return fail(413, "Request too large.");

  const who = clientKey(req.headers.get("x-forwarded-for"), intEnv("TRUSTED_PROXY_HOPS", 0));
  const wait = perClient.check(who) || everyone.check("all");
  if (wait) return fail(429, "Too many requests. Please wait a moment.", { "Retry-After": String(wait) });

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return fail(400, "Could not read the request body.");
  }
  if (raw.length > LIMITS.body) return fail(413, "Request too large.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Body is not valid JSON.");
  }
  const parsed = parseExplainRequest(body);
  if (!parsed.ok) return fail(400, parsed.error);

  const groq = new Groq({ apiKey, timeout: 20_000, maxRetries: 1 });
  try {
    const completion = await groq.chat.completions.create(
      {
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(parsed.value) },
        ],
        temperature: 0.3,
        // A reasoning model spends part of this budget thinking; the visible answer is 2-4 sentences.
        max_completion_tokens: 700,
        reasoning_effort: "low",
      },
      { signal: req.signal },
    );
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return fail(502, "The AI tutor returned no answer. Please try again.");
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // Never forward the provider's raw message to the browser.
    const status = (err as { status?: number }).status;
    if (status === 429) return fail(429, "The AI service is busy. Try again shortly.", { "Retry-After": "30" });
    return fail(502, "The AI service is unavailable right now.");
  }
}

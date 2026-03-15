import { promises as fs } from "fs";
import path from "path";

// ── Gemini 2.5 Flash pricing (per 1M tokens) ──
const PRICING = {
  "gemini-2.5-flash": {
    inputPerMillion: 0.15, // $0.15 per 1M input tokens
    outputPerMillion: 0.60, // $0.60 per 1M output tokens
    imagePerUnit: 0.0258, // $0.0258 per image
  },
} as const;

// USD to INR conversion
export const USD_TO_INR = 85.0;

export type ApiCallLog = {
  id: string;
  timestamp: string;
  endpoint: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  imageCount: number;
  estimatedCostUSD: number;
  estimatedCostINR: number;
  durationMs: number;
  status: "success" | "error";
  errorMessage?: string;
  // Context
  inputChars: number;
  page: string;
  triggerType: "auto" | "click"; // auto = triggered automatically, click = user-initiated
  promptSummary: string; // short description of the prompt (first 200 chars)
  promptText: string; // full prompt text for inspection
};

export type UsageSummary = {
  totalCalls: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalImages: number;
  totalCostUSD: number;
  totalCostINR: number;
  usdToInr: number;
  byEndpoint: Record<
    string,
    {
      calls: number;
      tokens: number;
      promptTokens: number;
      completionTokens: number;
      costUSD: number;
      costINR: number;
      avgDurationMs: number;
      errors: number;
    }
  >;
  byDay: Record<string, { calls: number; tokens: number; costINR: number }>;
  recentCalls: ApiCallLog[];
};

// ── File-based storage ──
const DATA_DIR = path.join(process.cwd(), ".api-usage");
const LOG_FILE = path.join(DATA_DIR, "usage-log.json");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

async function readLogs(): Promise<ApiCallLog[]> {
  try {
    const data = await fs.readFile(LOG_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeLogs(logs: ApiCallLog[]) {
  await ensureDataDir();
  await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
}

// ── Cost calculation ──
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  imageCount: number = 0
): { usd: number; inr: number } {
  const pricing =
    PRICING[model as keyof typeof PRICING] || PRICING["gemini-2.5-flash"];

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost =
    (completionTokens / 1_000_000) * pricing.outputPerMillion;
  const imageCost = imageCount * pricing.imagePerUnit;

  const usd = Math.round((inputCost + outputCost + imageCost) * 1_000_000) / 1_000_000;
  return { usd, inr: Math.round(usd * USD_TO_INR * 1_000_000) / 1_000_000 };
}

// ── Track an API call ──
export async function trackApiCall(
  entry: Omit<ApiCallLog, "id" | "timestamp" | "estimatedCostINR" | "estimatedCostUSD"> & {
    estimatedCostUSD: number;
    estimatedCostINR: number;
  }
) {
  const log: ApiCallLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  try {
    const logs = await readLogs();
    logs.push(log);

    // Keep last 10,000 entries max
    const trimmed = logs.length > 10000 ? logs.slice(-10000) : logs;
    await writeLogs(trimmed);
  } catch (err) {
    console.error("[API Tracker] Failed to write log:", err);
  }

  return log;
}

// ── Get usage summary ──
export async function getUsageSummary(
  days: number = 30
): Promise<UsageSummary> {
  const logs = await readLogs();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const filtered = logs.filter((l) => new Date(l.timestamp) >= cutoff);

  const byEndpoint: UsageSummary["byEndpoint"] = {};
  const byDay: UsageSummary["byDay"] = {};
  let totalTokens = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalImages = 0;
  let totalCostUSD = 0;
  let totalCostINR = 0;

  for (const log of filtered) {
    totalTokens += log.totalTokens;
    totalPromptTokens += log.promptTokens;
    totalCompletionTokens += log.completionTokens;
    totalImages += log.imageCount;
    totalCostUSD += log.estimatedCostUSD;
    totalCostINR += log.estimatedCostINR || log.estimatedCostUSD * USD_TO_INR;

    // By endpoint
    if (!byEndpoint[log.endpoint]) {
      byEndpoint[log.endpoint] = {
        calls: 0,
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        costUSD: 0,
        costINR: 0,
        avgDurationMs: 0,
        errors: 0,
      };
    }
    const ep = byEndpoint[log.endpoint];
    ep.calls++;
    ep.tokens += log.totalTokens;
    ep.promptTokens += log.promptTokens;
    ep.completionTokens += log.completionTokens;
    ep.costUSD += log.estimatedCostUSD;
    ep.costINR += log.estimatedCostINR || log.estimatedCostUSD * USD_TO_INR;
    ep.avgDurationMs =
      (ep.avgDurationMs * (ep.calls - 1) + log.durationMs) / ep.calls;
    if (log.status === "error") ep.errors++;

    // By day
    const day = log.timestamp.slice(0, 10);
    if (!byDay[day]) {
      byDay[day] = { calls: 0, tokens: 0, costINR: 0 };
    }
    byDay[day].calls++;
    byDay[day].tokens += log.totalTokens;
    byDay[day].costINR += log.estimatedCostINR || log.estimatedCostUSD * USD_TO_INR;
  }

  return {
    totalCalls: filtered.length,
    totalTokens,
    totalPromptTokens,
    totalCompletionTokens,
    totalImages,
    totalCostUSD: Math.round(totalCostUSD * 1_000_000) / 1_000_000,
    totalCostINR: Math.round(totalCostINR * 100) / 100,
    usdToInr: USD_TO_INR,
    byEndpoint,
    byDay,
    recentCalls: filtered.slice(-100).reverse(),
  };
}

// ── Get raw logs with filtering ──
export async function getRawLogs(options?: {
  endpoint?: string;
  days?: number;
  limit?: number;
}): Promise<ApiCallLog[]> {
  const logs = await readLogs();

  let filtered = logs;

  if (options?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.days);
    filtered = filtered.filter((l) => new Date(l.timestamp) >= cutoff);
  }

  if (options?.endpoint) {
    filtered = filtered.filter((l) => l.endpoint === options.endpoint);
  }

  if (options?.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered.reverse();
}

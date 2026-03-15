"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  DollarSign,
  Zap,
  Clock,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Lock,
  Image,
  X,
  Eye,
  MousePointer,
  Cpu,
} from "lucide-react";

// ── Types ──

type EndpointStats = {
  calls: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  costUSD: number;
  costINR: number;
  avgDurationMs: number;
  errors: number;
};

type DayStats = { calls: number; tokens: number; costINR: number };

type ApiCallLog = {
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
  inputChars: number;
  page: string;
  triggerType: "auto" | "click";
  promptSummary: string;
  promptText: string;
};

type UsageSummary = {
  totalCalls: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalImages: number;
  totalCostUSD: number;
  totalCostINR: number;
  usdToInr: number;
  byEndpoint: Record<string, EndpointStats>;
  byDay: Record<string, DayStats>;
  recentCalls: ApiCallLog[];
};

// ── Static API registry — all 8 endpoints ──

const API_REGISTRY = [
  {
    endpoint: "/api/chat",
    name: "Chat Assistant",
    page: "Bid Workspace",
    trigger: "click" as const,
    description: "Streaming tender Q&A with document citations. User sends messages, gets AI responses with [p.X] page references.",
    what: "Answers tender questions with page citations",
    model: "gemini-2.5-flash",
    type: "streamText",
    maxInput: "30,000 chars",
  },
  {
    endpoint: "/api/generate-checklist",
    name: "Compliance Checklist",
    page: "Bid Workspace",
    trigger: "click" as const,
    description: "Analyzes RFP against company vault. Returns 3 sections: Eligibility, Documents Required, Forms & Annexures. Each item has met/not_met/partial/unknown status.",
    what: "Matches RFP requirements vs company vault",
    model: "gemini-2.5-flash",
    type: "generateObject",
    maxInput: "80,000 chars",
  },
  {
    endpoint: "/api/generate-bid-checklist",
    name: "Bid Preparation Checklist",
    page: "Bid Workspace",
    trigger: "click" as const,
    description: "Creates a complete bid preparation checklist from RFP. Separates documents (to collect) vs annexures (to fill). Tags items with stamp paper, notarization, company seal requirements.",
    what: "Extracts bid documents + annexures with tags",
    model: "gemini-2.5-flash",
    type: "generateObject",
    maxInput: "80,000 chars",
  },
  {
    endpoint: "/api/extract-forms",
    name: "Form Extraction",
    page: "Bid Workspace",
    trigger: "click" as const,
    description: "Extracts every annexure, declaration, affidavit, and fillable form from the tender document as complete HTML content. Preserves tables, blank fields, and structure for DOCX export.",
    what: "Extracts all fillable forms as HTML",
    model: "gemini-2.5-flash",
    type: "generateObject",
    maxInput: "80,000 chars",
  },
  {
    endpoint: "/api/vault/extract-onboarding",
    name: "Onboarding Extraction",
    page: "Company Vault",
    trigger: "auto" as const,
    description: "Extracts company registration data from partnership deed / incorporation certificate. Supports both vision (scanned PDFs) and text modes. Gets company name, PAN, GSTIN, partners, address.",
    what: "Extracts company identity from registration docs",
    model: "gemini-2.5-flash",
    type: "generateObject",
    maxInput: "80,000 chars / 8 images",
  },
  {
    endpoint: "/api/vault/extract-metadata",
    name: "Metadata (Text)",
    page: "Company Vault",
    trigger: "auto" as const,
    description: "Extracts structured company info from uploaded document text. Gets turnover, past projects, certifications. Auto-categorizes document (Registration, Financial, Experience, Work Orders, etc.).",
    what: "Extracts metadata + categorizes from text",
    model: "gemini-2.5-flash",
    type: "generateObject",
    maxInput: "80,000 chars",
  },
  {
    endpoint: "/api/vault/extract-metadata-vision",
    name: "Metadata (Vision)",
    page: "Company Vault",
    trigger: "auto" as const,
    description: "Same as text metadata extraction but reads scanned document images directly. Preferred for scanned PDFs with garbled OCR text. Sends up to 10 JPEG images to Gemini vision.",
    what: "Extracts metadata + categorizes from images",
    model: "gemini-2.5-flash",
    type: "generateObject",
    maxInput: "10 images",
  },
  {
    endpoint: "/api/vault/aggregate-profile",
    name: "Profile Aggregation",
    page: "Company Vault",
    trigger: "auto" as const,
    description: "Merges metadata from all uploaded documents into one clean company profile. Deduplicates partners, turnover, projects, certifications. Uses entity-specific authority hierarchy (deed > work orders).",
    what: "Merges all docs into master company profile",
    model: "gemini-2.5-flash",
    type: "generateObject",
    maxInput: "100,000 chars",
  },
];

const ADMIN_SECRET = "alpha-admin-2024";

// ── Helpers ──

function formatINR(inr: number): string {
  if (inr < 0.01) return `₹${inr.toFixed(4)}`;
  if (inr < 1) return `₹${inr.toFixed(2)}`;
  return `₹${inr.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Main Component ──

export default function ApiCostsDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [secret, setSecret] = useState("");
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");
  const [promptModal, setPromptModal] = useState<{ title: string; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "registry" | "logs">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/usage?view=summary&days=${days}&secret=${ADMIN_SECRET}`);
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      setError("Failed to load usage data");
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated, days, fetchData]);

  // Auth screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <Lock size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg">Admin Access</h1>
              <p className="text-slate-400 text-sm">API Cost Dashboard</p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (secret === ADMIN_SECRET) setAuthenticated(true);
              else setError("Invalid secret");
            }}
          >
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter admin secret"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 rounded-lg transition-colors">
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Prompt Modal */}
      {promptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPromptModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="font-medium text-white">{promptModal.title}</h3>
              <button onClick={() => setPromptModal(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{promptModal.text}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <Activity size={18} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Gemini API Costs</h1>
              <p className="text-slate-500 text-xs">Private admin dashboard &middot; All costs in ₹ INR</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value={1}>Last 24h</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>All time</option>
            </select>
            <button onClick={fetchData} disabled={loading} className="bg-slate-800 border border-slate-700 rounded-lg p-2 hover:bg-slate-700 disabled:opacity-50">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-1">
          {(["overview", "registry", "logs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-300"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "registry" ? "All APIs (8)" : "Call Logs"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="max-w-[1400px] mx-auto px-6 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">{error}</div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {activeTab === "overview" && <OverviewTab data={data} />}
        {activeTab === "registry" && <RegistryTab data={data} onViewPrompt={(title, text) => setPromptModal({ title, text })} />}
        {activeTab === "logs" && <LogsTab data={data} onViewPrompt={(title, text) => setPromptModal({ title, text })} />}
      </main>
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab({ data }: { data: UsageSummary | null }) {
  if (!data) return <p className="text-slate-500 py-20 text-center">No data yet. Use the app to generate API calls.</p>;

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<DollarSign size={18} />} label="Total Spent" value={formatINR(data.totalCostINR)} color="emerald" />
        <StatCard icon={<Zap size={18} />} label="API Calls" value={data.totalCalls.toString()} color="indigo" />
        <StatCard icon={<TrendingUp size={18} />} label="Input Tokens" value={formatTokens(data.totalPromptTokens)} color="violet" />
        <StatCard icon={<Cpu size={18} />} label="Output Tokens" value={formatTokens(data.totalCompletionTokens)} color="blue" />
        <StatCard icon={<Image size={18} />} label="Images" value={data.totalImages.toString()} color="pink" />
      </div>

      {/* Endpoint breakdown + Daily */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Cost by Endpoint</h2>
          <div className="space-y-3">
            {Object.entries(data.byEndpoint)
              .sort(([, a], [, b]) => b.costINR - a.costINR)
              .map(([endpoint, stats]) => {
                const reg = API_REGISTRY.find((r) => r.endpoint === endpoint);
                const pct = data.totalCostINR > 0 ? (stats.costINR / data.totalCostINR) * 100 : 0;
                return (
                  <div key={endpoint}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-200">{reg?.name || endpoint}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-500">{stats.calls} calls</span>
                        <span className="text-emerald-400 font-medium">{formatINR(stats.costINR)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Daily Spending</h2>
          <div className="space-y-2">
            {Object.entries(data.byDay)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 14)
              .map(([day, stats]) => {
                const maxCost = Math.max(...Object.values(data.byDay).map((d) => d.costINR));
                const pct = maxCost > 0 ? (stats.costINR / maxCost) * 100 : 0;
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-16 shrink-0">
                      {new Date(day + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden relative">
                      <div className="h-full bg-indigo-500/40 rounded" style={{ width: `${Math.max(pct, 2)}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-xs text-slate-300">{stats.calls} calls</span>
                    </div>
                    <span className="text-xs text-emerald-400 font-medium w-14 text-right">{formatINR(stats.costINR)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-slate-300 mb-3">Gemini 2.5 Flash Pricing (1 USD = ₹{data.usdToInr})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-slate-500">Input tokens</p><p className="text-white font-medium">₹{(0.15 * data.usdToInr).toFixed(2)} / 1M tokens</p></div>
          <div><p className="text-slate-500">Output tokens</p><p className="text-white font-medium">₹{(0.60 * data.usdToInr).toFixed(2)} / 1M tokens</p></div>
          <div><p className="text-slate-500">Images</p><p className="text-white font-medium">₹{(0.0258 * data.usdToInr).toFixed(2)} / image</p></div>
          <div><p className="text-slate-500">Model</p><p className="text-white font-medium">gemini-2.5-flash</p></div>
        </div>
      </div>
    </div>
  );
}

// ── Registry Tab — All 8 APIs in a table ──

function RegistryTab({
  data,
  onViewPrompt,
}: {
  data: UsageSummary | null;
  onViewPrompt: (title: string, text: string) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-slate-400 text-sm">Complete registry of all Gemini API endpoints in the app. Every API call that costs money is listed here.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-3 text-slate-400 font-medium">#</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">API Name</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Endpoint</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Origin Page</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Trigger</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">What it Does</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Type</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Max Input</th>
              <th className="text-right py-3 px-3 text-slate-400 font-medium">Calls</th>
              <th className="text-right py-3 px-3 text-slate-400 font-medium">Input Tok</th>
              <th className="text-right py-3 px-3 text-slate-400 font-medium">Output Tok</th>
              <th className="text-right py-3 px-3 text-slate-400 font-medium">Total Tok</th>
              <th className="text-right py-3 px-3 text-slate-400 font-medium">Cost (₹)</th>
              <th className="text-right py-3 px-3 text-slate-400 font-medium">Avg Time</th>
              <th className="text-right py-3 px-3 text-slate-400 font-medium">Errors</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium">Prompt</th>
            </tr>
          </thead>
          <tbody>
            {API_REGISTRY.map((api, i) => {
              const stats = data?.byEndpoint[api.endpoint];
              const lastCall = data?.recentCalls.find((c) => c.endpoint === api.endpoint);

              return (
                <tr key={api.endpoint} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="py-3 px-3 text-slate-500">{i + 1}</td>
                  <td className="py-3 px-3">
                    <span className="text-white font-medium">{api.name}</span>
                  </td>
                  <td className="py-3 px-3">
                    <code className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{api.endpoint}</code>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">{api.page}</span>
                  </td>
                  <td className="py-3 px-3">
                    {api.trigger === "click" ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">
                        <MousePointer size={10} /> Click
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded">
                        <Cpu size={10} /> Auto
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 max-w-[200px]">
                    <span className="text-slate-300 text-xs">{api.what}</span>
                  </td>
                  <td className="py-3 px-3">
                    <code className="text-xs text-slate-400">{api.type}</code>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-400">{api.maxInput}</td>
                  <td className="py-3 px-3 text-right text-white font-medium">{stats?.calls ?? 0}</td>
                  <td className="py-3 px-3 text-right text-slate-300">{stats ? formatTokens(stats.promptTokens) : "—"}</td>
                  <td className="py-3 px-3 text-right text-slate-300">{stats ? formatTokens(stats.completionTokens) : "—"}</td>
                  <td className="py-3 px-3 text-right text-slate-200 font-medium">{stats ? formatTokens(stats.tokens) : "—"}</td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-medium">{stats ? formatINR(stats.costINR) : "₹0"}</td>
                  <td className="py-3 px-3 text-right text-slate-400">{stats ? formatDuration(Math.round(stats.avgDurationMs)) : "—"}</td>
                  <td className="py-3 px-3 text-right">
                    {stats?.errors ? <span className="text-red-400">{stats.errors}</span> : <span className="text-slate-600">0</span>}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {lastCall?.promptText ? (
                      <button
                        onClick={() => onViewPrompt(`${api.name} — Full Prompt`, lastCall.promptText)}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                        title="View full prompt"
                      >
                        <Eye size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onViewPrompt(`${api.name} — Description`, api.description)}
                        className="text-slate-600 hover:text-slate-400 transition-colors"
                        title="View API description"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {data && (
            <tfoot>
              <tr className="border-t-2 border-slate-700 bg-slate-900/50">
                <td colSpan={8} className="py-3 px-3 text-slate-300 font-medium">TOTAL</td>
                <td className="py-3 px-3 text-right text-white font-bold">{data.totalCalls}</td>
                <td className="py-3 px-3 text-right text-white font-bold">{formatTokens(data.totalPromptTokens)}</td>
                <td className="py-3 px-3 text-right text-white font-bold">{formatTokens(data.totalCompletionTokens)}</td>
                <td className="py-3 px-3 text-right text-white font-bold">{formatTokens(data.totalTokens)}</td>
                <td className="py-3 px-3 text-right text-emerald-400 font-bold">{formatINR(data.totalCostINR)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ── Logs Tab — Individual call log ──

function LogsTab({
  data,
  onViewPrompt,
}: {
  data: UsageSummary | null;
  onViewPrompt: (title: string, text: string) => void;
}) {
  if (!data || data.recentCalls.length === 0) {
    return <p className="text-slate-500 py-20 text-center">No API calls recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-2 text-slate-400 font-medium">Time</th>
            <th className="text-left py-3 px-2 text-slate-400 font-medium">API</th>
            <th className="text-left py-3 px-2 text-slate-400 font-medium">Page</th>
            <th className="text-left py-3 px-2 text-slate-400 font-medium">Trigger</th>
            <th className="text-left py-3 px-2 text-slate-400 font-medium">Prompt Summary</th>
            <th className="text-right py-3 px-2 text-slate-400 font-medium">Input Tok</th>
            <th className="text-right py-3 px-2 text-slate-400 font-medium">Output Tok</th>
            <th className="text-right py-3 px-2 text-slate-400 font-medium">Total Tok</th>
            <th className="text-right py-3 px-2 text-slate-400 font-medium">Images</th>
            <th className="text-right py-3 px-2 text-slate-400 font-medium">Cost (₹)</th>
            <th className="text-right py-3 px-2 text-slate-400 font-medium">Duration</th>
            <th className="text-center py-3 px-2 text-slate-400 font-medium">Status</th>
            <th className="text-center py-3 px-2 text-slate-400 font-medium">Prompt</th>
          </tr>
        </thead>
        <tbody>
          {data.recentCalls.map((log) => {
            const reg = API_REGISTRY.find((r) => r.endpoint === log.endpoint);
            return (
              <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                <td className="py-2.5 px-2">
                  <div className="text-xs text-slate-400">{timeAgo(log.timestamp)}</div>
                  <div className="text-[10px] text-slate-600">{new Date(log.timestamp).toLocaleString("en-IN")}</div>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-white text-xs font-medium">{reg?.name || log.endpoint}</span>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-xs bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{log.page}</span>
                </td>
                <td className="py-2.5 px-2">
                  {log.triggerType === "click" ? (
                    <span className="text-xs text-blue-400">Click</span>
                  ) : (
                    <span className="text-xs text-amber-400">Auto</span>
                  )}
                </td>
                <td className="py-2.5 px-2 max-w-[250px]">
                  <span className="text-xs text-slate-400 truncate block">{log.promptSummary || "—"}</span>
                </td>
                <td className="py-2.5 px-2 text-right text-xs text-slate-300">{log.promptTokens.toLocaleString("en-IN")}</td>
                <td className="py-2.5 px-2 text-right text-xs text-slate-300">{log.completionTokens.toLocaleString("en-IN")}</td>
                <td className="py-2.5 px-2 text-right text-xs text-white font-medium">{log.totalTokens.toLocaleString("en-IN")}</td>
                <td className="py-2.5 px-2 text-right text-xs text-slate-400">{log.imageCount || "—"}</td>
                <td className="py-2.5 px-2 text-right text-xs text-emerald-400 font-medium">
                  {formatINR(log.estimatedCostINR || log.estimatedCostUSD * 85)}
                </td>
                <td className="py-2.5 px-2 text-right text-xs text-slate-400">{formatDuration(log.durationMs)}</td>
                <td className="py-2.5 px-2 text-center">
                  {log.status === "error" ? (
                    <span title={log.errorMessage}><AlertTriangle size={14} className="text-red-400 inline" /></span>
                  ) : (
                    <span className="text-emerald-400 text-xs">OK</span>
                  )}
                </td>
                <td className="py-2.5 px-2 text-center">
                  {log.promptText ? (
                    <button
                      onClick={() => onViewPrompt(`${reg?.name || log.endpoint} — ${timeAgo(log.timestamp)}`, log.promptText)}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      <Eye size={14} />
                    </button>
                  ) : (
                    <span className="text-slate-700">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Stat Card ──

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    violet: "bg-violet-500/10 text-violet-400",
    blue: "bg-blue-500/10 text-blue-400",
    pink: "bg-pink-500/10 text-pink-400",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>{icon}</div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

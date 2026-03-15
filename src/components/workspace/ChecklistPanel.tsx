"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ClipboardCheck,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { useVaultStore } from "@/store/vaultStore";
import type {
  ComplianceChecklist,
  ChecklistSection,
  ChecklistItem,
  ChecklistStatus,
} from "@/lib/types";

interface ChecklistPanelProps {
  documentText: string;
  onCitationClick?: (page: number) => void;
}

const STATUS_CONFIG: Record<
  ChecklistStatus,
  { icon: typeof CheckCircle2; label: string; bg: string; text: string; border: string }
> = {
  met: {
    icon: CheckCircle2,
    label: "Met",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  not_met: {
    icon: XCircle,
    label: "Not Met",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
  partial: {
    icon: AlertTriangle,
    label: "Partial",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  unknown: {
    icon: HelpCircle,
    label: "Unknown",
    bg: "bg-gray-50",
    text: "text-gray-500",
    border: "border-gray-200",
  },
};

function StatusBadge({ status }: { status: ChecklistStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function SummaryBar({ summary }: { summary: ComplianceChecklist["summary"] }) {
  if (summary.total === 0) return null;
  const segments = [
    { count: summary.met, color: "bg-emerald-500" },
    { count: summary.partial, color: "bg-amber-400" },
    { count: summary.notMet, color: "bg-red-500" },
    { count: summary.unknown, color: "bg-gray-300" },
  ];
  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        {segments.map(
          (seg, i) =>
            seg.count > 0 && (
              <div
                key={i}
                className={`${seg.color} transition-all`}
                style={{ width: `${(seg.count / summary.total) * 100}%` }}
              />
            )
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <span className="text-emerald-600 font-medium">{summary.met} met</span>
        <span className="text-amber-600 font-medium">{summary.partial} partial</span>
        <span className="text-red-600 font-medium">{summary.notMet} not met</span>
        {summary.unknown > 0 && (
          <span className="text-gray-400">{summary.unknown} unknown</span>
        )}
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  onCitationClick,
}: {
  section: ChecklistSection;
  onCitationClick?: (page: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const met = section.items.filter((i) => i.status === "met").length;
  const total = section.items.length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={14} className="text-gray-400" />
          ) : (
            <ChevronRight size={14} className="text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-800">
            {section.title}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {met}/{total} met
        </span>
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {section.items.map((item, i) => (
            <ItemCard key={i} item={item} onCitationClick={onCitationClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  onCitationClick,
}: {
  item: ChecklistItem;
  onCitationClick?: (page: number) => void;
}) {
  return (
    <div className="px-3 py-2.5 hover:bg-gray-50/50">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          <StatusBadge status={item.status} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug">
            {item.requirement}
          </p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {item.reasoning}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {item.sourcePages.map((page) => (
              <button
                key={page}
                onClick={() => onCitationClick?.(page)}
                className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
              >
                p.{page}
              </button>
            ))}
            {item.matchedVaultDocs?.map((doc) => (
              <span
                key={doc}
                className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-50 text-violet-600 rounded border border-violet-100"
              >
                {doc}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChecklistPanel({
  documentText,
  onCitationClick,
}: ChecklistPanelProps) {
  const [checklist, setChecklist] = useState<ComplianceChecklist | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const prevDocRef = useRef(documentText);

  const companyProfile = useVaultStore((s) => s.companyProfile);
  const documents = useVaultStore((s) => s.documents);

  // Reset when document changes
  useEffect(() => {
    if (documentText !== prevDocRef.current) {
      prevDocRef.current = documentText;
      setChecklist(null);
      setGenerated(false);
      setError(null);
    }
  }, [documentText]);

  const handleGenerate = async () => {
    if (!documentText) return;
    setIsGenerating(true);
    setError(null);
    try {
      const vaultDocuments = documents.map((d) => ({
        name: d.name,
        category: d.category,
        fileType: d.fileType,
      }));

      const res = await fetch("/api/generate-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentContext: documentText,
          companyProfile,
          vaultDocuments,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data: ComplianceChecklist = await res.json();
      setChecklist(data);
      setGenerated(true);
    } catch (e) {
      console.error("Checklist generation failed:", e);
      setError("Failed to generate checklist. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // No document loaded
  if (!documentText) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No document loaded</p>
          <p className="text-xs mt-1">
            Select a PDF document first to generate a compliance checklist
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto mb-3 animate-spin text-indigo-500"
          />
          <p className="text-sm font-medium text-gray-700">
            Analyzing compliance requirements...
          </p>
          <p className="text-xs text-gray-400 mt-1">
            AI is reading the RFP and matching against your vault. This may take
            a moment.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button size="sm" onClick={handleGenerate}>
            <RefreshCw size={14} className="mr-1" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Not yet generated
  if (!generated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-xs">
          <ClipboardCheck size={48} className="mx-auto mb-3 text-indigo-200" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            Compliance Checklist
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Generate a structured checklist of all eligibility, document, and
            form requirements from this RFP — auto-matched against your Company
            Vault.
          </p>
          {!companyProfile && (
            <div className="flex items-start gap-2 p-2.5 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
              <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Set up your Company Vault for automatic matching. Without it,
                requirements will be marked as &ldquo;unknown&rdquo;.
              </p>
            </div>
          )}
          <Button onClick={handleGenerate} className="gap-1.5">
            <ClipboardCheck size={14} />
            Generate Checklist
          </Button>
        </div>
      </div>
    );
  }

  // No items found
  if (!checklist || checklist.sections.every((s) => s.items.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No requirements found</p>
          <p className="text-xs mt-1">
            The AI could not identify compliance requirements in this document.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={handleGenerate}
          >
            <RefreshCw size={14} className="mr-1" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Results
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-xs text-gray-500">
          {checklist.summary.total} items checked
          <span className="text-emerald-600 ml-1">
            &middot; {checklist.summary.met} met
          </span>
          {checklist.summary.notMet > 0 && (
            <span className="text-red-600 ml-1">
              &middot; {checklist.summary.notMet} not met
            </span>
          )}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handleGenerate}
        >
          <RefreshCw size={12} />
          Re-generate
        </Button>
      </div>

      <SummaryBar summary={checklist.summary} />

      {/* Sections */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {checklist.sections
          .filter((s) => s.items.length > 0)
          .map((section, i) => (
            <SectionBlock
              key={i}
              section={section}
              onCitationClick={onCitationClick}
            />
          ))}
      </div>
    </div>
  );
}

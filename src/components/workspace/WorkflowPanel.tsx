"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ClipboardCheck,
  RefreshCw,
  Eye,
  Check,
  Lock,
  Upload,
  FileText,
  FolderOpen,
  Package,
} from "lucide-react";
import { useVaultStore } from "@/store/vaultStore";
import type { BidChecklistItem } from "@/lib/types";

interface WorkflowPanelProps {
  tenderName: string;
  fileCount: number;
  documentText: string;
  onPreviewPages: (pages: number[]) => void;
}

export function WorkflowPanel({
  tenderName,
  fileCount,
  documentText,
  onPreviewPages,
}: WorkflowPanelProps) {
  const [items, setItems] = useState<BidChecklistItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const prevDocRef = useRef(documentText);

  const companyProfile = useVaultStore((s) => s.companyProfile);
  const documents = useVaultStore((s) => s.documents);

  const approvedCount = items.filter((i) => i.status === "approved").length;
  const allApproved = generated && items.length > 0 && approvedCount === items.length;

  useEffect(() => {
    if (documentText !== prevDocRef.current) {
      prevDocRef.current = documentText;
      setItems([]);
      setGenerated(false);
      setError(null);
    }
  }, [documentText]);

  const handleGenerate = async () => {
    if (!documentText) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-bid-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentContext: documentText,
          companyProfile,
          vaultDocuments: documents.map((d) => ({
            name: d.name,
            category: d.category,
            fileType: d.fileType,
          })),
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setItems(data.items || []);
      setGenerated(true);
    } catch (e) {
      console.error("Bid checklist generation failed:", e);
      setError("Failed to generate checklist. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = (id: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "approved" ? "pending" : "approved" }
          : item
      )
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tender Summary */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-900 truncate">{tenderName}</h2>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Upload size={11} />
            Uploaded
          </span>
          <span className="flex items-center gap-1">
            <FileText size={11} />
            {fileCount} Document{fileCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Phase 1: AI Checklist */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Phase header */}
        <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100">
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            1
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-800">AI Checklist</div>
            <div className="text-[10px] text-gray-400">Review and approve each item</div>
          </div>
          {generated && items.length > 0 && (
            <span className="text-[10px] font-semibold text-indigo-600 whitespace-nowrap">
              {approvedCount} / {items.length} approved
            </span>
          )}
        </div>

        {/* Progress bar */}
        {generated && items.length > 0 && (
          <div className="shrink-0 px-4 pt-2">
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${(approvedCount / items.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!documentText ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Waiting for document"
              subtitle="Document text is being extracted..."
            />
          ) : isGenerating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 size={28} className="mx-auto mb-2.5 animate-spin text-indigo-500" />
                <p className="text-xs font-medium text-gray-700">Analyzing RFP...</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Creating your bid preparation checklist
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4">
                <p className="text-xs text-red-600 mb-2">{error}</p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleGenerate}>
                  <RefreshCw size={12} className="mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          ) : !generated ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-6">
                <ClipboardCheck size={36} className="mx-auto mb-2 text-indigo-200" />
                <p className="text-xs font-medium text-gray-700 mb-1">
                  Generate Bid Checklist
                </p>
                <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
                  AI will analyze this RFP and create a structured checklist of everything needed for your bid submission.
                </p>
                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleGenerate}>
                  <ClipboardCheck size={13} />
                  Generate Checklist
                </Button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No items found"
              subtitle="Could not identify bid requirements"
              action={
                <Button size="sm" variant="outline" className="h-7 text-xs mt-2" onClick={handleGenerate}>
                  <RefreshCw size={12} className="mr-1" />
                  Try Again
                </Button>
              }
            />
          ) : (
            <div className="py-1.5">
              {items.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  onPreview={() => onPreviewPages(item.sourcePages)}
                  onApprove={() => handleApprove(item.id)}
                />
              ))}
              {/* Re-generate */}
              <div className="px-4 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] text-gray-400 gap-1 w-full"
                  onClick={handleGenerate}
                >
                  <RefreshCw size={10} />
                  Re-generate checklist
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase 2 & 3 Placeholders */}
      <div className="shrink-0 border-t border-gray-200">
        <PhaseCard
          number={2}
          title="Document Preparation"
          subtitle="AI drafts, you fill & approve"
          icon={FolderOpen}
          ready={allApproved}
        />
        <PhaseCard
          number={3}
          title="Compiled Technical Bid"
          subtitle="AI compiles all docs into one bid"
          icon={Package}
          locked
        />
      </div>
    </div>
  );
}

function ChecklistItemRow({
  item,
  onPreview,
  onApprove,
}: {
  item: BidChecklistItem;
  onPreview: () => void;
  onApprove: () => void;
}) {
  const isApproved = item.status === "approved";

  return (
    <div className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50/80 transition-colors">
      {/* Number */}
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
          isApproved
            ? "bg-emerald-100 text-emerald-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {isApproved ? <Check size={10} /> : item.id}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 leading-snug">{item.name}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
          {item.particular}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button
          onClick={onPreview}
          className="p-1 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
          title="Preview in document"
        >
          <Eye size={13} />
        </button>
        {isApproved ? (
          <button
            onClick={onApprove}
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            Approved
          </button>
        ) : (
          <button
            onClick={onApprove}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            Approve
          </button>
        )}
      </div>
    </div>
  );
}

function PhaseCard({
  number,
  title,
  subtitle,
  icon: Icon,
  ready,
  locked,
}: {
  number: number;
  title: string;
  subtitle: string;
  icon: typeof FolderOpen;
  ready?: boolean;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b last:border-b-0 border-gray-100">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          ready
            ? "bg-emerald-100 text-emerald-700"
            : "bg-gray-200 text-gray-400"
        }`}
      >
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold ${ready ? "text-gray-800" : "text-gray-400"}`}>
          {title}
        </div>
        <div className="text-[10px] text-gray-400">
          {ready ? "Ready to start" : subtitle}
        </div>
      </div>
      {!ready && (
        <Lock size={12} className="text-gray-300 shrink-0" />
      )}
      {ready && (
        <span className="text-[10px] font-semibold text-emerald-600">Ready</span>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="text-center px-4">
        <Icon size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-xs font-medium">{title}</p>
        <p className="text-[10px] mt-0.5">{subtitle}</p>
        {action}
      </div>
    </div>
  );
}

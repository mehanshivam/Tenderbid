"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ClipboardCheck,
  RefreshCw,
  Eye,
  Check,
  Lock,
  Upload,
  Download,
  FileText,
  FolderOpen,
  Package,
  Paperclip,
  X,
} from "lucide-react";
import { useVaultStore } from "@/store/vaultStore";
import { saveFile } from "@/lib/vaultDB";
import type { BidChecklistItem, ExtractedForm, FormTag } from "@/lib/types";

interface WorkflowPanelProps {
  tenderName: string;
  fileCount: number;
  documentText: string;
  extractedForms: ExtractedForm[];
  isExtracting: boolean;
  onPreviewItem: (item: BidChecklistItem) => void;
  onOpenForm: (form: ExtractedForm) => void;
}

// ─── Fuzzy matching: checklist item → extracted form ───
const STOP_WORDS = new Set([
  "the", "for", "and", "from", "with", "that", "this", "has", "have",
  "been", "not", "are", "was", "were", "will", "can", "may", "shall",
  "needs", "need",
]);

/** Basic stemming: remove trailing s/es/ed/ing for comparison */
function stem(word: string): string {
  return word
    .replace(/ations$/, "ation")
    .replace(/ments$/, "ment")
    .replace(/ies$/, "y")
    .replace(/es$/, "e")
    .replace(/s$/, "");
}

function findMatchingForm(
  item: BidChecklistItem,
  forms: ExtractedForm[]
): ExtractedForm | null {
  if (forms.length === 0) return null;
  const searchText = `${item.name} ${item.particular}`.toLowerCase();

  // 1. Try number-based match first (Annexure-3, Form 2, Schedule-B1, Declaration Letter 1)
  const formNumMatch = searchText.match(/(?:annexure|form|schedule|declaration(?:\s+letter)?)[-\s]?(\d+)/i);
  if (formNumMatch) {
    const num = formNumMatch[1];
    const found = forms.find((f) =>
      new RegExp(`(?:annexure|form|schedule|declaration)[-\\s]?(?:letter\\s*)?0?${num}\\b`, "i").test(f.title)
    );
    if (found) return found;
  }

  // 2. Fuzzy keyword match using stemmed words
  const itemWords = item.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (itemWords.length === 0) return null;

  const itemStems = itemWords.map(stem);

  let bestMatch: ExtractedForm | null = null;
  let bestScore = 0;

  for (const form of forms) {
    const formTitle = form.title.toLowerCase();
    const formStems = formTitle
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map(stem);
    const formStemStr = formStems.join(" ");

    let score = 0;
    for (const s of itemStems) {
      if (formStemStr.includes(s)) score++;
    }
    const ratio = score / itemStems.length;
    if (ratio > bestScore && ratio >= 0.35) {
      bestScore = ratio;
      bestMatch = form;
    }
  }

  return bestMatch;
}

const TAG_STYLES: Record<string, { bg: string; text: string }> = {
  "Needs Stamp Paper": { bg: "bg-amber-50", text: "text-amber-700" },
  "Needs Notarization": { bg: "bg-purple-50", text: "text-purple-700" },
  "On Company Letterhead": { bg: "bg-blue-50", text: "text-blue-700" },
  "Needs Company Seal": { bg: "bg-rose-50", text: "text-rose-700" },
  "Needs Affidavit": { bg: "bg-orange-50", text: "text-orange-700" },
  "Needs Attestation": { bg: "bg-teal-50", text: "text-teal-700" },
  "Needs Witness Signature": { bg: "bg-pink-50", text: "text-pink-700" },
  "Needs Court Fee Stamp": { bg: "bg-yellow-50", text: "text-yellow-700" },
  "Needs Board Resolution": { bg: "bg-indigo-50", text: "text-indigo-700" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkflowPanel({
  tenderName,
  fileCount,
  documentText,
  extractedForms,
  isExtracting,
  onPreviewItem,
  onOpenForm,
}: WorkflowPanelProps) {
  const [items, setItems] = useState<BidChecklistItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const prevDocRef = useRef(documentText);

  const companyProfile = useVaultStore((s) => s.companyProfile);
  const documents = useVaultStore((s) => s.documents);

  const approvedCount = items.filter((i) => i.status === "approved").length;
  const uploadedCount = items.filter(
    (i) => i.status === "uploaded" || i.status === "approved"
  ).length;
  const allApproved =
    generated && items.length > 0 && approvedCount === items.length;

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
      const newItems: BidChecklistItem[] = (data.items || []).map(
        (item: BidChecklistItem) => ({
          ...item,
          tags: item.tags || [],
          type: item.type || "document",
        })
      );
      setItems(newItems);
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
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.status === "approved") return { ...item, status: "pending" };
        return { ...item, status: "approved" };
      })
    );
  };

  const handleFileUpload = useCallback(
    async (itemId: number, file: File) => {
      const dbId = `checklist-${tenderName}-${itemId}`;
      try {
        await saveFile(dbId, file);
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: "uploaded" as const,
                  uploadedFile: {
                    name: file.name,
                    size: file.size,
                    uploadedAt: new Date().toISOString(),
                    dbId,
                  },
                }
              : item
          )
        );
      } catch (e) {
        console.error("File upload failed:", e);
      }
    },
    [tenderName]
  );

  const handleRemoveFile = useCallback((itemId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, status: "pending" as const, uploadedFile: undefined }
          : item
      )
    );
  }, []);

  const handleDownloadForm = useCallback(async (form: ExtractedForm) => {
    try {
      const res = await fetch("/api/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: form.contentHtml,
          filename: form.title,
          tags: form.tags,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("DOCX download failed:", e);
    }
  }, []);

  const documentItems = items.filter((i) => i.type === "document");
  const annexureItems = items.filter((i) => i.type === "annexure");

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tender Summary */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-900 truncate">
          {tenderName}
        </h2>
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

      {/* Phase 1: Bid Checklist */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Phase header */}
        <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100">
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            1
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-800">
              Bid Preparation Checklist
            </div>
            <div className="text-[10px] text-gray-400">
              Collect documents & fill annexures
            </div>
          </div>
          {generated && items.length > 0 && (
            <span className="text-[10px] font-semibold text-indigo-600 whitespace-nowrap">
              {approvedCount} / {items.length} done
            </span>
          )}
        </div>

        {/* Progress bar */}
        {generated && items.length > 0 && (
          <div className="shrink-0 px-4 pt-2">
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${(approvedCount / items.length) * 100}%`,
                }}
              />
              <div
                className="h-full bg-blue-400 transition-all duration-300"
                style={{
                  width: `${((uploadedCount - approvedCount) / items.length) * 100}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[9px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {approvedCount} approved
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {uploadedCount - approvedCount} uploaded
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                {items.length - uploadedCount} pending
              </span>
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
                <Loader2
                  size={28}
                  className="mx-auto mb-2.5 animate-spin text-indigo-500"
                />
                <p className="text-xs font-medium text-gray-700">
                  Analyzing RFP...
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Extracting documents & annexures
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4">
                <p className="text-xs text-red-600 mb-2">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleGenerate}
                >
                  <RefreshCw size={12} className="mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          ) : !generated ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-6">
                <ClipboardCheck
                  size={36}
                  className="mx-auto mb-2 text-indigo-200"
                />
                <p className="text-xs font-medium text-gray-700 mb-1">
                  Generate Bid Checklist
                </p>
                <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
                  AI will analyze this RFP and create a structured checklist of
                  documents to collect and annexures to fill.
                </p>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleGenerate}
                >
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
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs mt-2"
                  onClick={handleGenerate}
                >
                  <RefreshCw size={12} className="mr-1" />
                  Try Again
                </Button>
              }
            />
          ) : (
            <div className="py-1">
              {/* Documents Section */}
              {documentItems.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2">
                    <FolderOpen size={12} className="text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Documents to Collect
                    </span>
                    <span className="text-[10px] text-gray-300">
                      ({documentItems.length})
                    </span>
                  </div>
                  {documentItems.map((item) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      onPreview={() => onPreviewItem(item)}
                      onApprove={() => handleApprove(item.id)}
                      onFileUpload={(file) => handleFileUpload(item.id, file)}
                      onRemoveFile={() => handleRemoveFile(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* Annexures Section */}
              {annexureItems.length > 0 && (
                <div className={documentItems.length > 0 ? "mt-2" : ""}>
                  <div className="px-4 py-2 flex items-center gap-2">
                    <FileText size={12} className="text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Annexures to Fill
                    </span>
                    <span className="text-[10px] text-gray-300">
                      ({annexureItems.length})
                    </span>
                    {isExtracting && (
                      <span className="flex items-center gap-1 text-[9px] text-indigo-500 ml-auto animate-pulse">
                        <Loader2 size={9} className="animate-spin" />
                        Extracting forms...
                      </span>
                    )}
                    {!isExtracting && extractedForms.length > 0 && (
                      <span className="text-[9px] text-emerald-500 ml-auto font-medium">
                        {extractedForms.length} forms ready
                      </span>
                    )}
                  </div>
                  {annexureItems.map((item) => {
                    const matchedForm = findMatchingForm(item, extractedForms);
                    return (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        onPreview={() =>
                          matchedForm
                            ? onOpenForm(matchedForm)
                            : onPreviewItem(item)
                        }
                        onApprove={() => handleApprove(item.id)}
                        onFileUpload={(file) => handleFileUpload(item.id, file)}
                        onRemoveFile={() => handleRemoveFile(item.id)}
                        isAnnexure
                        matchedForm={matchedForm}
                        isFormExtracting={isExtracting}
                        onDownloadForm={
                          matchedForm
                            ? () => handleDownloadForm(matchedForm)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              )}

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
  onFileUpload,
  onRemoveFile,
  isAnnexure,
  matchedForm,
  isFormExtracting,
  onDownloadForm,
}: {
  item: BidChecklistItem;
  onPreview: () => void;
  onApprove: () => void;
  onFileUpload: (file: File) => void;
  onRemoveFile: () => void;
  isAnnexure?: boolean;
  matchedForm?: ExtractedForm | null;
  isFormExtracting?: boolean;
  onDownloadForm?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isApproved = item.status === "approved";
  const isUploaded = item.status === "uploaded";
  const hasFile = !!item.uploadedFile;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  };

  return (
    <div
      className={`px-3 py-2 hover:bg-gray-50/80 transition-colors ${
        isAnnexure ? "mx-2 mb-1.5 rounded-lg border border-gray-100" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Status indicator */}
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
            isApproved
              ? "bg-emerald-100 text-emerald-700"
              : isUploaded
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-500"
          }`}
        >
          {isApproved ? (
            <Check size={10} />
          ) : isUploaded ? (
            <Paperclip size={9} />
          ) : (
            item.id
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800 leading-snug">
            {item.name}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
            {item.particular}
          </p>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tags.map((tag) => {
                const style = TAG_STYLES[tag] || {
                  bg: "bg-gray-50",
                  text: "text-gray-600",
                };
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${style.bg} ${style.text}`}
                  >
                    {tag.replace("Needs ", "").replace("On ", "")}
                  </span>
                );
              })}
            </div>
          )}

          {/* Uploaded file info */}
          {hasFile && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
              <Paperclip size={9} className="text-blue-500 shrink-0" />
              <span className="text-blue-600 truncate max-w-[140px]">
                {item.uploadedFile!.name}
              </span>
              <span className="text-gray-300">
                ({formatFileSize(item.uploadedFile!.size)})
              </span>
              <button
                onClick={onRemoveFile}
                className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                title="Remove file"
              >
                <X size={9} />
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
            title={hasFile ? "Replace file" : "Upload document"}
          >
            <Upload size={13} />
          </button>

          {/* Download DOCX — only for annexures with matched forms */}
          {isAnnexure && matchedForm && onDownloadForm && (
            <button
              onClick={onDownloadForm}
              className="p-1 rounded hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700 transition-colors"
              title="Download as DOCX"
            >
              <Download size={13} />
            </button>
          )}

          {/* Extracting spinner — annexure without match yet */}
          {isAnnexure && !matchedForm && isFormExtracting && (
            <span className="p-1" title="Extracting form content...">
              <Loader2 size={12} className="animate-spin text-indigo-400" />
            </span>
          )}

          {/* Preview / Open form button */}
          <button
            onClick={onPreview}
            className={`p-1 rounded transition-colors ${
              isAnnexure && matchedForm
                ? "hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700"
                : "hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
            }`}
            title={
              isAnnexure && matchedForm
                ? "Open form editor"
                : isAnnexure && isFormExtracting
                  ? "Form being extracted..."
                  : "Preview in document"
            }
          >
            <Eye size={13} />
          </button>

          {/* Approve button */}
          {isApproved ? (
            <button
              onClick={onApprove}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              Done
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
        <div
          className={`text-xs font-semibold ${ready ? "text-gray-800" : "text-gray-400"}`}
        >
          {title}
        </div>
        <div className="text-[10px] text-gray-400">
          {ready ? "Ready to start" : subtitle}
        </div>
      </div>
      {!ready && <Lock size={12} className="text-gray-300 shrink-0" />}
      {ready && (
        <span className="text-[10px] font-semibold text-emerald-600">
          Ready
        </span>
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

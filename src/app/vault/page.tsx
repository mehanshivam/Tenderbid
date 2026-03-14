"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  FolderOpen,
  X,
  File,
  FileSpreadsheet,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVaultStore } from "@/store/vaultStore";
import {
  VAULT_CATEGORIES,
  FOLDER_CATEGORY_MAP,
  type VaultCategory,
  type VaultDocumentMeta,
  type ExtractedMetadata,
} from "@/lib/types";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  saveFile,
  getFile,
  saveMetadata,
  getAllMetadata,
  getMetadata,
  saveCompanyProfile,
} from "@/lib/vaultDB";
import { migrateVaultIfNeeded } from "@/lib/vaultMigration";
import { extractTextFromBlob } from "@/lib/extractText";
import { aggregateProfile } from "@/lib/aggregateProfile";

const ACCEPTED_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.jpg,.jpeg,.png";

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return <FileText size={20} className="text-red-400" />;
  if (["xls", "xlsx", "csv"].includes(ext))
    return <FileSpreadsheet size={20} className="text-green-400" />;
  if (["doc", "docx"].includes(ext))
    return <FileText size={20} className="text-blue-400" />;
  if (["jpg", "jpeg", "png"].includes(ext))
    return <File size={20} className="text-purple-400" />;
  return <File size={20} className="text-slate-400" />;
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toUpperCase() || "FILE";
}

/** Detect vault category from folder path in webkitRelativePath */
function detectCategory(file: File): VaultCategory | null {
  const path = (file as File & { webkitRelativePath?: string })
    .webkitRelativePath;
  if (!path) return null;
  const parts = path.split("/");
  for (let i = parts.length - 2; i >= 0; i--) {
    const folder = parts[i].toLowerCase().trim();
    if (FOLDER_CATEGORY_MAP[folder]) {
      return FOLDER_CATEGORY_MAP[folder];
    }
  }
  return null;
}

function ExtractionBadge({
  status,
}: {
  status: VaultDocumentMeta["extractionStatus"];
}) {
  switch (status) {
    case "extracting":
      return (
        <span className="flex items-center gap-1 text-xs text-amber-400">
          <Loader2 size={12} className="animate-spin" /> Classifying...
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 size={12} /> Ready
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <AlertCircle size={12} /> Failed
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Loader2 size={12} className="animate-spin" /> Queued
        </span>
      );
  }
}

/** Category suggestion banner shown on cards after AI extraction */
function CategorySuggestion({
  docId,
  suggested,
  alternates,
  confidence,
  onAccept,
  onDismiss,
}: {
  docId: string;
  suggested: VaultCategory;
  alternates: VaultCategory[];
  confidence: string;
  onAccept: (docId: string, category: VaultCategory) => void;
  onDismiss: (docId: string) => void;
}) {
  const allOptions = [suggested, ...alternates.filter((a) => a !== suggested)];

  return (
    <div className="mt-2 pt-2 border-t border-indigo-500/20 bg-indigo-500/5 -mx-4 -mb-4 px-4 pb-3 rounded-b-xl">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={12} className="text-indigo-400" />
        <span className="text-xs text-indigo-300 font-medium">
          AI suggests:
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allOptions.map((cat, i) => (
          <button
            key={cat}
            onClick={() => onAccept(docId, cat)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full transition-colors",
              i === 0
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30"
                : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300"
            )}
          >
            {cat}
            {i === 0 && confidence === "high" && " ✓"}
          </button>
        ))}
        <button
          onClick={() => onDismiss(docId)}
          className="text-xs px-2 py-1 text-slate-500 hover:text-slate-400"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// Track which docs need category confirmation
interface PendingCategorization {
  docId: string;
  suggested: VaultCategory;
  alternates: VaultCategory[];
  confidence: "high" | "medium" | "low";
}

// Document detail popup component
function DocumentDetailPopup({
  doc,
  onClose,
  onDelete,
  onRetry,
}: {
  doc: VaultDocumentMeta;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    // Load blob for preview
    getFile(doc.id).then((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      }
    });
    // Load metadata
    getMetadata(doc.id).then((meta) => {
      setMetadata(meta || null);
      setLoadingMeta(false);
    });
  }, [doc.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = doc.name;
    a.click();
  };

  const ext = doc.name.split(".").pop()?.toLowerCase() || "";
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png"].includes(ext);

  const hasAnyMeta =
    metadata &&
    (metadata.companyName ||
      metadata.pan ||
      metadata.gstin ||
      metadata.registeredAddress ||
      (metadata.partners && metadata.partners.length > 0) ||
      (metadata.turnover && metadata.turnover.length > 0) ||
      (metadata.pastProjects && metadata.pastProjects.length > 0) ||
      (metadata.certifications && metadata.certifications.length > 0));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-slate-700/50 rounded-lg shrink-0">
              {getFileIcon(doc.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {doc.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">
                  {getFileExtension(doc.name)}
                </span>
                <span className="text-xs text-slate-500">
                  {formatFileSize(doc.fileSize)}
                </span>
                <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  {doc.category}
                </span>
                <ExtractionBadge status={doc.extractionStatus} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!previewUrl}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Eye size={14} className="mr-1.5" />
              Download
            </Button>
            {doc.extractionStatus === "failed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRetry(doc.id)}
                className="border-amber-600 text-amber-400 hover:bg-amber-500/10"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Retry
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDelete(doc.id);
                onClose();
              }}
              className="border-red-800 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={14} className="mr-1.5" />
              Delete
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body — split: preview left, metadata right */}
        <div className="flex-1 overflow-hidden flex">
          {/* Preview */}
          <div className="flex-1 overflow-auto bg-slate-900/50 flex items-center justify-center p-4">
            {!previewUrl ? (
              <div className="text-slate-500 text-center">
                <Loader2 size={32} className="mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading preview...</p>
              </div>
            ) : isPdf ? (
              <iframe
                src={previewUrl}
                className="w-full h-full min-h-[400px] rounded-lg border border-slate-700"
                title={doc.name}
              />
            ) : isImage ? (
              <img
                src={previewUrl}
                alt={doc.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-center text-slate-500">
                <File size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Preview not available for this file type</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="mt-3 border-slate-600 text-slate-300"
                >
                  Download to view
                </Button>
              </div>
            )}
          </div>

          {/* Metadata sidebar */}
          <div className="w-80 border-l border-slate-700 overflow-y-auto p-4 shrink-0">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400" />
              AI Extracted Metadata
            </h3>

            {loadingMeta ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 size={14} className="animate-spin" />
                Loading...
              </div>
            ) : !hasAnyMeta ? (
              <p className="text-sm text-slate-500">
                {doc.extractionStatus === "pending" || doc.extractionStatus === "extracting"
                  ? "Extraction in progress..."
                  : doc.extractionStatus === "failed"
                    ? "Extraction failed. Try again with the Retry button."
                    : ext !== "pdf"
                      ? "Metadata extraction is only available for PDF files."
                      : "No metadata could be extracted from this document."}
              </p>
            ) : (
              <div className="space-y-4">
                {metadata?.companyName && (
                  <MetaField label="Company Name" value={metadata.companyName} />
                )}
                {metadata?.pan && (
                  <MetaField label="PAN" value={metadata.pan} mono />
                )}
                {metadata?.gstin && (
                  <MetaField label="GSTIN" value={metadata.gstin} mono />
                )}
                {metadata?.registeredAddress && (
                  <MetaField label="Address" value={metadata.registeredAddress} />
                )}
                {metadata?.partners && metadata.partners.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">
                      Partners / Directors
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {metadata.partners.map((p) => (
                        <span
                          key={p}
                          className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {metadata?.turnover && metadata.turnover.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">
                      Turnover
                    </p>
                    <div className="space-y-1">
                      {metadata.turnover.map((t) => (
                        <div
                          key={t.year}
                          className="flex justify-between text-xs bg-slate-700/50 rounded px-2 py-1.5"
                        >
                          <span className="text-slate-400">{t.year}</span>
                          <span className="text-white font-medium">
                            {t.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {metadata?.pastProjects && metadata.pastProjects.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">
                      Projects ({metadata.pastProjects.length})
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {metadata.pastProjects.map((proj, i) => (
                        <div
                          key={i}
                          className="bg-slate-700/30 rounded px-2.5 py-1.5"
                        >
                          <p className="text-xs text-white font-medium truncate">
                            {proj.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {proj.client} &bull; {proj.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {metadata?.certifications &&
                  metadata.certifications.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">
                        Certifications
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {metadata.certifications.map((c) => (
                          <span
                            key={c}
                            className="text-xs px-2 py-0.5 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 rounded-full"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                {metadata?.suggestedCategory && (
                  <MetaField
                    label="AI Category"
                    value={`${metadata.suggestedCategory} (${metadata.categoryConfidence || "medium"} confidence)`}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className={cn("text-sm text-white", mono && "font-mono")}>{value}</p>
    </div>
  );
}

export default function VaultPage() {
  const {
    documents,
    companyProfile,
    addDocuments,
    removeDocument,
    updateExtractionStatus,
    updateCategory,
    setCompanyProfile,
  } = useVaultStore();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<VaultDocumentMeta | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<
    PendingCategorization[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const extractionQueueRef = useRef<string[]>([]);
  const isExtractingRef = useRef(false);

  // Run migration on mount
  useEffect(() => {
    migrateVaultIfNeeded().then((migrated) => {
      if (migrated.length > 0) {
        addDocuments(migrated);
      }
    });
    // Load company profile from IndexedDB on mount
    import("@/lib/vaultDB").then(({ getCompanyProfile }) => {
      getCompanyProfile().then((profile) => {
        if (profile) setCompanyProfile(profile);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Category Confirmation Handlers ───

  const handleAcceptCategory = useCallback(
    (docId: string, category: VaultCategory) => {
      updateCategory(docId, category);
      setPendingCategories((prev) => prev.filter((p) => p.docId !== docId));
    },
    [updateCategory]
  );

  const handleDismissCategory = useCallback((docId: string) => {
    setPendingCategories((prev) => prev.filter((p) => p.docId !== docId));
  }, []);

  // ─── Metadata Extraction Queue ───

  const processExtractionQueue = useCallback(async () => {
    if (isExtractingRef.current) return;
    isExtractingRef.current = true;

    while (extractionQueueRef.current.length > 0) {
      const batch = extractionQueueRef.current.splice(0, 3);

      await Promise.allSettled(
        batch.map(async (docId) => {
          const doc = useVaultStore
            .getState()
            .documents.find((d) => d.id === docId);
          if (!doc) return;

          const ext = doc.name.split(".").pop()?.toLowerCase() || "";
          if (ext !== "pdf") {
            updateExtractionStatus(docId, "done");
            return;
          }

          try {
            updateExtractionStatus(docId, "extracting");

            const blob = await getFile(docId);
            if (!blob) {
              updateExtractionStatus(docId, "failed");
              return;
            }

            const text = await extractTextFromBlob(blob, ext);
            if (!text || text.length < 50) {
              updateExtractionStatus(docId, "done");
              await saveMetadata(docId, {}, "done");
              return;
            }

            const res = await fetch("/api/vault/extract-metadata", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text,
                fileName: doc.name,
                fileType: ext,
              }),
            });

            if (!res.ok) throw new Error(`API error: ${res.status}`);
            const metadata: ExtractedMetadata = await res.json();

            await saveMetadata(docId, metadata, "done");
            updateExtractionStatus(docId, "done");

            // Handle AI category suggestion
            if (metadata.suggestedCategory) {
              const confidence = metadata.categoryConfidence || "medium";

              if (confidence === "high") {
                // Auto-apply high confidence categories
                updateCategory(docId, metadata.suggestedCategory);
              } else {
                // Show confirmation for medium/low confidence
                setPendingCategories((prev) => [
                  ...prev.filter((p) => p.docId !== docId),
                  {
                    docId,
                    suggested: metadata.suggestedCategory!,
                    alternates: (metadata.alternateCategories || []) as VaultCategory[],
                    confidence,
                  },
                ]);
              }
            }
          } catch (err) {
            console.error(`[Vault] Extraction failed for ${doc.name}:`, err);
            updateExtractionStatus(docId, "failed");
          }
        })
      );
    }

    isExtractingRef.current = false;
    await refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateExtractionStatus, updateCategory]);

  const refreshProfile = async () => {
    try {
      const allMeta = await getAllMetadata();
      if (allMeta.length === 0) return;
      const profile = aggregateProfile(allMeta);
      await saveCompanyProfile(profile);
      setCompanyProfile(profile);
    } catch (err) {
      console.error("[Vault] Profile aggregation failed:", err);
    }
  };

  // ─── File Upload Handler ───

  const handleFiles = useCallback(
    async (files: FileList | File[], folderUpload = false) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setUploadProgress({ current: 0, total: fileArray.length, fileName: "" });
      const newDocs: VaultDocumentMeta[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress({
          current: i + 1,
          total: fileArray.length,
          fileName: file.name,
        });

        const id = crypto.randomUUID();
        const ext = file.name.split(".").pop()?.toLowerCase() || "";

        // For folder uploads, try to detect from folder name
        const detectedCategory = folderUpload ? detectCategory(file) : null;
        // Default to "Other" — AI will re-classify after extraction
        const category = detectedCategory || "Other";

        await saveFile(id, file, "pending");

        const meta: VaultDocumentMeta = {
          id,
          name: file.name,
          category,
          fileType: ext,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          extractionStatus: "pending",
        };

        newDocs.push(meta);
        extractionQueueRef.current.push(id);
      }

      addDocuments(newDocs);
      setUploadProgress(null);
      setShowUpload(false);
      processExtractionQueue();
    },
    [addDocuments, processExtractionQueue]
  );

  const handleRetryExtraction = useCallback(
    (docId: string) => {
      extractionQueueRef.current.push(docId);
      processExtractionQueue();
    },
    [processExtractionQueue]
  );

  const handleOpenDetail = useCallback((doc: VaultDocumentMeta) => {
    setSelectedDoc(doc);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleRefreshProfile = async () => {
    setRefreshingProfile(true);
    await refreshProfile();
    setRefreshingProfile(false);
  };

  const filtered =
    activeCategory === "All"
      ? documents
      : documents.filter((d) => d.category === activeCategory);

  const categoryCounts = VAULT_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = documents.filter((d) => d.category === cat).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const pendingCount = pendingCategories.length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Company Vault</h1>
          <p className="text-sm text-slate-400 mt-1">
            Drop your company documents — AI classifies, organizes, and extracts
            key data automatically.
          </p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          <Upload size={16} />
          Upload Documents
        </Button>
      </div>

      {/* Pending categorization banner */}
      {pendingCount > 0 && (
        <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center gap-3">
          <Sparkles size={18} className="text-indigo-400 shrink-0" />
          <p className="text-sm text-indigo-300">
            <span className="font-medium">{pendingCount} document{pendingCount > 1 ? "s" : ""}</span>{" "}
            need your confirmation on category placement. Look for the suggestions below.
          </p>
        </div>
      )}

      {/* Company Profile Card */}
      {companyProfile && companyProfile.companyName && (
        <div className="mb-6 bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={20} className="text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">
                Company Profile
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshProfile}
              disabled={refreshingProfile}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw
                size={14}
                className={cn("mr-1.5", refreshingProfile && "animate-spin")}
              />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Company Name
              </p>
              <p className="text-sm text-white font-medium">
                {companyProfile.companyName}
              </p>
            </div>
            {companyProfile.pan && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  PAN
                </p>
                <p className="text-sm text-white font-mono">
                  {companyProfile.pan}
                </p>
              </div>
            )}
            {companyProfile.gstin && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  GSTIN
                </p>
                <p className="text-sm text-white font-mono">
                  {companyProfile.gstin}
                </p>
              </div>
            )}
            {companyProfile.registeredAddress && (
              <div className="md:col-span-2 lg:col-span-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  Registered Address
                </p>
                <p className="text-sm text-slate-300">
                  {companyProfile.registeredAddress}
                </p>
              </div>
            )}
          </div>

          {companyProfile.partners.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                Partners / Directors
              </p>
              <div className="flex flex-wrap gap-2">
                {companyProfile.partners.map((p) => (
                  <span
                    key={p}
                    className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded-full"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {companyProfile.turnoverHistory.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                Turnover History
              </p>
              <div className="flex flex-wrap gap-3">
                {companyProfile.turnoverHistory.map((t) => (
                  <div
                    key={t.year}
                    className="bg-slate-700/50 rounded-lg px-3 py-2 text-center"
                  >
                    <p className="text-xs text-slate-400">{t.year}</p>
                    <p className="text-sm text-white font-medium">{t.amount}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {companyProfile.pastProjects.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowProjects(!showProjects)}
                className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors"
              >
                Past Projects ({companyProfile.totalProjects})
                {showProjects ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
              {showProjects && (
                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                  {companyProfile.pastProjects.map((proj, i) => (
                    <div
                      key={i}
                      className="bg-slate-700/30 rounded-lg px-3 py-2 text-sm"
                    >
                      <p className="text-white font-medium">{proj.name}</p>
                      <p className="text-slate-400 text-xs">
                        {proj.client} &bull; {proj.value} &bull; {proj.year}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {companyProfile.certifications.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                Certifications
              </p>
              <div className="flex flex-wrap gap-2">
                {companyProfile.certifications.map((c) => (
                  <span
                    key={c}
                    className="text-xs px-2.5 py-1 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 rounded-full"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory("All")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            activeCategory === "All"
              ? "bg-indigo-500/20 text-indigo-300"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
          )}
        >
          All ({documents.length})
        </button>
        {VAULT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              activeCategory === cat
                ? "bg-indigo-500/20 text-indigo-300"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
            )}
          >
            {cat} ({categoryCounts[cat] || 0})
          </button>
        ))}
      </div>

      {/* Document grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium text-slate-400">
            No documents yet
          </p>
          <p className="text-sm mt-1">
            {activeCategory === "All"
              ? "Upload your company documents — AI will organize them for you."
              : `No documents in "${activeCategory}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc) => {
            const pending = pendingCategories.find(
              (p) => p.docId === doc.id
            );

            return (
              <div
                key={doc.id}
                onClick={() => handleOpenDetail(doc)}
                className={cn(
                  "bg-slate-800/50 border rounded-xl p-4 transition-colors group cursor-pointer",
                  pending
                    ? "border-indigo-500/40"
                    : "border-slate-700 hover:border-slate-600"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-700/50 rounded-lg shrink-0">
                    {getFileIcon(doc.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium text-white truncate"
                      title={doc.name}
                    >
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">
                        {getFileExtension(doc.name)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ExtractionBadge status={doc.extractionStatus} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
                  <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full truncate max-w-[55%]">
                    {doc.category}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {doc.extractionStatus === "failed" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRetryExtraction(doc.id); }}
                        className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
                        title="Retry extraction"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenDetail(doc); }}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                      title="Preview & Metadata"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* AI Category suggestion */}
                {pending && (
                  <CategorySuggestion
                    docId={doc.id}
                    suggested={pending.suggested}
                    alternates={pending.alternates}
                    confidence={pending.confidence}
                    onAccept={handleAcceptCategory}
                    onDismiss={handleDismissCategory}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Document detail popup */}
      {selectedDoc && (
        <DocumentDetailPopup
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={(id) => { removeDocument(id); setSelectedDoc(null); }}
          onRetry={handleRetryExtraction}
        />
      )}

      {/* Upload modal — no category picker, AI handles it */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Upload Documents
              </h2>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 hover:bg-slate-700 rounded-lg text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* AI clerk info */}
            <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-sm text-indigo-300">
                  Just drop your files — AI will read each document, classify
                  it into the right category, and extract company metadata
                  automatically.
                </p>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                dragOver
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-slate-600"
              )}
            >
              <Upload size={32} className="mx-auto mb-3 text-slate-500" />
              <p className="text-sm text-slate-400 mb-3">
                Drag & drop files here, or choose below
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!uploadProgress}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <FileText size={14} className="mr-1.5" />
                  Select Files
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={!!uploadProgress}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <FolderOpen size={14} className="mr-1.5" />
                  Select Folder
                </Button>
              </div>

              {uploadProgress && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="truncate max-w-[70%]">
                      {uploadProgress.fileName}
                    </span>
                    <span>
                      {uploadProgress.current} / {uploadProgress.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{
                        width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-3">
              PDF, DOC, DOCX, XLS, XLSX, CSV, ZIP, RAR, JPG, PNG supported.
            </p>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-expect-error webkitdirectory is not in types
              webkitdirectory=""
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  const supported = Array.from(e.target.files).filter((f) => {
                    const ext = f.name.split(".").pop()?.toLowerCase() || "";
                    return [
                      "pdf", "doc", "docx", "xls", "xlsx", "csv", "zip",
                      "rar", "jpg", "jpeg", "png",
                    ].includes(ext);
                  });
                  handleFiles(supported, true);
                }
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

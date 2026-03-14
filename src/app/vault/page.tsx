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
  Download,
  Shield,
  Hash,
  MapPin,
  Users,
  TrendingUp,
  Briefcase,
  Award,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVaultStore } from "@/store/vaultStore";
import {
  VAULT_CATEGORIES,
  FOLDER_CATEGORY_MAP,
  type VaultCategory,
  type VaultDocumentMeta,
  type ExtractedMetadata,
  type CompanyProfile,
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
  clearAllData,
} from "@/lib/vaultDB";
import { migrateVaultIfNeeded } from "@/lib/vaultMigration";
import {
  extractTextFromBlob,
  renderPdfPagesToImages,
} from "@/lib/extractText";
import { aggregateProfile } from "@/lib/aggregateProfile";
import OnboardingWizard from "./_components/OnboardingWizard";

const ACCEPTED_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.jpg,.jpeg,.png";

function getFileIcon(name: string, size = 20) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return <FileText size={size} className="text-red-400" />;
  if (["xls", "xlsx", "csv"].includes(ext))
    return <FileSpreadsheet size={size} className="text-emerald-400" />;
  if (["doc", "docx"].includes(ext))
    return <FileText size={size} className="text-blue-400" />;
  if (["jpg", "jpeg", "png"].includes(ext))
    return <Image size={size} className="text-violet-400" />;
  return <File size={size} className="text-slate-400" />;
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

/* ──────────────────── Extraction Badge ──────────────────── */

function ExtractionBadge({
  status,
}: {
  status: VaultDocumentMeta["extractionStatus"];
}) {
  switch (status) {
    case "extracting":
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Loader2 size={10} className="animate-spin" /> Classifying
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={10} /> Ready
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle size={10} /> Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <Loader2 size={10} className="animate-spin" /> Queued
        </span>
      );
  }
}

/* ──────────────────── Category Suggestion ──────────────────── */

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
    <div className="mt-3 pt-3 border-t border-indigo-500/20">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={12} className="text-indigo-400" />
        <span className="text-[11px] text-indigo-300 font-medium">
          AI suggests:
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allOptions.map((cat, i) => (
          <button
            key={cat}
            onClick={(e) => {
              e.stopPropagation();
              onAccept(docId, cat);
            }}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-full transition-all duration-200",
              i === 0
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 hover:scale-[1.03]"
                : "bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-300"
            )}
          >
            {cat}
            {i === 0 && confidence === "high" && " \u2713"}
          </button>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(docId);
          }}
          className="text-[11px] px-2 py-1 text-slate-500 hover:text-slate-400 transition-colors"
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

/* ──────────────────── Meta Field ──────────────────── */

function MetaField({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="group">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-slate-500">{icon}</span>}
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "text-sm text-slate-200 leading-relaxed",
          mono && "font-mono text-xs tracking-wide"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ──────────────────── Document Detail Popup ──────────────────── */

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
    getFile(doc.id).then((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    });
    getMetadata(doc.id).then((meta) => {
      setMetadata(meta || null);
      setLoadingMeta(false);
    });
  }, [doc.id]);

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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0f1729] border border-slate-700/60 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-slate-700/40 rounded-xl shrink-0 ring-1 ring-slate-600/30">
              {getFileIcon(doc.name, 22)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {doc.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-700/60 rounded text-slate-400">
                  {getFileExtension(doc.name)}
                </span>
                <span className="text-[11px] text-slate-500">
                  {formatFileSize(doc.fileSize)}
                </span>
                <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {doc.category}
                </span>
                <ExtractionBadge status={doc.extractionStatus} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!previewUrl}
              className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 bg-transparent text-xs h-8"
            >
              <Download size={13} className="mr-1.5" />
              Download
            </Button>
            {doc.extractionStatus === "failed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRetry(doc.id)}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 bg-transparent text-xs h-8"
              >
                <RefreshCw size={13} className="mr-1.5" />
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
              className="border-red-500/20 text-red-400 hover:bg-red-500/10 bg-transparent text-xs h-8"
            >
              <Trash2 size={13} className="mr-1.5" />
              Delete
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-500 hover:text-slate-300 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body — split: preview left, metadata right */}
        <div className="flex-1 overflow-hidden flex">
          {/* Preview */}
          <div className="flex-1 overflow-auto bg-[#080d1a] flex items-center justify-center p-4">
            {!previewUrl ? (
              <div className="text-slate-600 text-center">
                <Loader2
                  size={32}
                  className="mx-auto mb-3 animate-spin text-slate-500"
                />
                <p className="text-sm">Loading preview...</p>
              </div>
            ) : isPdf ? (
              <iframe
                src={previewUrl}
                className="w-full h-full min-h-[500px] rounded-lg border border-slate-700/40"
                title={doc.name}
              />
            ) : isImage ? (
              <img
                src={previewUrl}
                alt={doc.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-center text-slate-600">
                <File size={48} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  Preview not available for this file type
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="mt-4 border-slate-600/50 text-slate-400 bg-transparent"
                >
                  Download to view
                </Button>
              </div>
            )}
          </div>

          {/* Metadata sidebar */}
          <div className="w-80 border-l border-slate-700/40 overflow-y-auto shrink-0 bg-[#0c1220]">
            <div className="p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles size={13} className="text-indigo-400" />
                AI Extracted Data
              </h3>

              {loadingMeta ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : !hasAnyMeta ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <FileText size={20} className="text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {doc.extractionStatus === "pending" ||
                    doc.extractionStatus === "extracting"
                      ? "Extraction in progress..."
                      : doc.extractionStatus === "failed"
                        ? "Extraction failed. Use the Retry button above."
                        : ext !== "pdf"
                          ? "Metadata extraction is only available for PDFs."
                          : "No metadata found in this document."}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {metadata?.companyName && (
                    <MetaField
                      label="Company Name"
                      value={metadata.companyName}
                      icon={<Building2 size={12} />}
                    />
                  )}
                  {metadata?.pan && (
                    <MetaField
                      label="PAN"
                      value={metadata.pan}
                      icon={<Shield size={12} />}
                      mono
                    />
                  )}
                  {metadata?.gstin && (
                    <MetaField
                      label="GSTIN"
                      value={metadata.gstin}
                      icon={<Hash size={12} />}
                      mono
                    />
                  )}
                  {metadata?.registeredAddress && (
                    <MetaField
                      label="Address"
                      value={metadata.registeredAddress}
                      icon={<MapPin size={12} />}
                    />
                  )}
                  {metadata?.partners && metadata.partners.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users size={12} className="text-slate-500" />
                        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                          Partners / Directors
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {metadata.partners.map((p) => (
                          <span
                            key={p}
                            className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700/50"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {metadata?.turnover && metadata.turnover.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp size={12} className="text-slate-500" />
                        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                          Turnover
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {metadata.turnover.map((t) => (
                          <div
                            key={t.year}
                            className="flex justify-between text-xs bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/30"
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
                  {metadata?.pastProjects &&
                    metadata.pastProjects.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Briefcase size={12} className="text-slate-500" />
                          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                            Projects ({metadata.pastProjects.length})
                          </p>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                          {metadata.pastProjects.map((proj, i) => (
                            <div
                              key={i}
                              className="bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/20"
                            >
                              <p className="text-xs text-slate-200 font-medium truncate">
                                {proj.name}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
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
                        <div className="flex items-center gap-1.5 mb-2">
                          <Award size={12} className="text-slate-500" />
                          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                            Certifications
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {metadata.certifications.map((c) => (
                            <span
                              key={c}
                              className="text-xs px-2.5 py-1 bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 rounded-lg"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  {metadata?.suggestedCategory && (
                    <div className="pt-3 border-t border-slate-700/30">
                      <MetaField
                        label="AI Category"
                        value={`${metadata.suggestedCategory} (${metadata.categoryConfidence || "medium"} confidence)`}
                        icon={<Sparkles size={12} />}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Main Vault Page ──────────────────── */

export default function VaultPage() {
  const {
    documents,
    companyProfile,
    addDocuments,
    removeDocument,
    updateExtractionStatus,
    updateCategory,
    setCompanyProfile,
    onboardingComplete,
    isHydrated,
  } = useVaultStore();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<VaultDocumentMeta | null>(
    null
  );
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
  const [extractionProgress, setExtractionProgress] = useState<{
    total: number;
    done: number;
    failed: number;
    current: string;
  } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Run migration on mount
  useEffect(() => {
    migrateVaultIfNeeded().then((migrated) => {
      if (migrated.length > 0) {
        addDocuments(migrated);
      }
    });
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

    const totalInQueue = extractionQueueRef.current.length;
    let doneCount = 0;
    let failedCount = 0;

    if (totalInQueue > 0) {
      setExtractionProgress({
        total: totalInQueue,
        done: 0,
        failed: 0,
        current: "Starting...",
      });
    }

    while (extractionQueueRef.current.length > 0) {
      const batch = extractionQueueRef.current.splice(0, 3);

      await Promise.allSettled(
        batch.map(async (docId) => {
          const doc = useVaultStore
            .getState()
            .documents.find((d) => d.id === docId);
          if (!doc) {
            doneCount++;
            return;
          }

          const ext = doc.name.split(".").pop()?.toLowerCase() || "";
          // Only extract text from PDF and DOCX files
          if (!["pdf", "doc", "docx"].includes(ext)) {
            updateExtractionStatus(docId, "done");
            doneCount++;
            setExtractionProgress((p) =>
              p ? { ...p, done: doneCount, current: doc.name } : null
            );
            return;
          }

          try {
            updateExtractionStatus(docId, "extracting");
            setExtractionProgress((p) =>
              p ? { ...p, current: doc.name } : null
            );

            const blob = await getFile(docId);
            if (!blob) {
              console.error(
                `[Vault] No blob found in IndexedDB for ${doc.name}`
              );
              updateExtractionStatus(docId, "failed");
              failedCount++;
              doneCount++;
              setExtractionProgress((p) =>
                p
                  ? { ...p, done: doneCount, failed: failedCount }
                  : null
              );
              return;
            }

            const text = await extractTextFromBlob(blob, ext);

            let metadata: ExtractedMetadata;

            if (!text || text.length < 50) {
              // Text extraction failed — try vision for PDFs (scanned documents)
              if (ext === "pdf") {
                console.log(
                  `[Vault] Text extraction insufficient for ${doc.name}, trying vision...`
                );
                setExtractionProgress((p) =>
                  p
                    ? { ...p, current: `${doc.name} (scanning pages...)` }
                    : null
                );
                const images = await renderPdfPagesToImages(blob);
                if (images.length === 0) {
                  console.warn(
                    `[Vault] Vision rendering also failed for ${doc.name}`
                  );
                  updateExtractionStatus(docId, "done");
                  await saveMetadata(docId, {}, "done");
                  doneCount++;
                  setExtractionProgress((p) =>
                    p ? { ...p, done: doneCount } : null
                  );
                  return;
                }

                const visionRes = await fetch(
                  "/api/vault/extract-metadata-vision",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      images,
                      fileName: doc.name,
                      fileType: ext,
                    }),
                  }
                );

                if (!visionRes.ok) {
                  const errText = await visionRes.text().catch(() => "");
                  throw new Error(
                    `Vision API ${visionRes.status}: ${errText.slice(0, 200)}`
                  );
                }
                metadata = await visionRes.json();
              } else {
                // Non-PDF with no text — nothing we can do
                console.warn(
                  `[Vault] Insufficient text from ${doc.name} (${text.length} chars)`
                );
                updateExtractionStatus(docId, "done");
                await saveMetadata(docId, {}, "done");
                doneCount++;
                setExtractionProgress((p) =>
                  p ? { ...p, done: doneCount } : null
                );
                return;
              }
            } else {
              // Normal text-based extraction
              const res = await fetch("/api/vault/extract-metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text,
                  fileName: doc.name,
                  fileType: ext,
                }),
              });

              if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(
                  `API ${res.status}: ${errText.slice(0, 200)}`
                );
              }
              metadata = await res.json();
            }

            await saveMetadata(docId, metadata, "done");
            updateExtractionStatus(docId, "done");

            if (metadata.suggestedCategory) {
              const confidence = metadata.categoryConfidence || "medium";

              if (confidence === "high") {
                updateCategory(docId, metadata.suggestedCategory);
              } else {
                setPendingCategories((prev) => [
                  ...prev.filter((p) => p.docId !== docId),
                  {
                    docId,
                    suggested: metadata.suggestedCategory!,
                    alternates: (metadata.alternateCategories ||
                      []) as VaultCategory[],
                    confidence,
                  },
                ]);
              }
            }

            doneCount++;
            setExtractionProgress((p) =>
              p ? { ...p, done: doneCount } : null
            );
          } catch (err) {
            console.error(`[Vault] Extraction failed for ${doc.name}:`, err);
            updateExtractionStatus(docId, "failed");
            failedCount++;
            doneCount++;
            setExtractionProgress((p) =>
              p
                ? { ...p, done: doneCount, failed: failedCount }
                : null
            );
          }
        })
      );
    }

    isExtractingRef.current = false;
    setExtractionProgress(null);
    await refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateExtractionStatus, updateCategory]);

  // Merge new aggregated data with locked onboarding fields
  const mergeWithLockedFields = (newProfile: CompanyProfile): CompanyProfile => {
    const existing = useVaultStore.getState().companyProfile;
    const isLocked = useVaultStore.getState().onboardingComplete && existing;

    if (!isLocked) return newProfile;

    return {
      // LOCKED: constant fields from onboarding
      entityType: existing.entityType,
      companyName: existing.companyName,
      yearOfEstablishment: existing.yearOfEstablishment,
      businessDomain: existing.businessDomain,
      stateCity: existing.stateCity,
      pan: existing.pan,
      gstin: existing.gstin,
      registeredAddress: existing.registeredAddress,
      partners: existing.partners,
      onboardingDocId: existing.onboardingDocId,
      // DYNAMIC: from new aggregation
      turnoverHistory: newProfile.turnoverHistory || [],
      pastProjects: newProfile.pastProjects || [],
      totalProjects: newProfile.pastProjects?.length || 0,
      certifications: newProfile.certifications || [],
      registrations: newProfile.registrations || existing.registrations || [],
      lastUpdated: new Date().toISOString(),
    };
  };

  const refreshProfile = async () => {
    try {
      const allMeta = await getAllMetadata();
      if (allMeta.length === 0) return;

      // Get document names for context
      const currentDocs = useVaultStore.getState().documents;
      const docNameMap = new Map(currentDocs.map((d) => [d.id, d.name]));

      // Enrich entries with file names for the AI
      const docCategoryMap = new Map(
        currentDocs.map((d) => [d.id, d.category])
      );
      const enrichedEntries = allMeta.map((e) => ({
        ...e,
        fileName: docNameMap.get(e.id) || undefined,
        category: docCategoryMap.get(e.id) || undefined,
      }));

      // Try AI-powered aggregation first (smarter dedup, fixes OCR errors)
      try {
        const res = await fetch("/api/vault/aggregate-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: enrichedEntries }),
        });

        if (res.ok) {
          const aiProfile = await res.json();
          const newProfile = {
            ...aiProfile,
            totalProjects: aiProfile.pastProjects?.length || 0,
            lastUpdated: new Date().toISOString(),
          };
          const finalProfile = mergeWithLockedFields(newProfile);
          await saveCompanyProfile(finalProfile);
          setCompanyProfile(finalProfile);
          return;
        }
      } catch (aiErr) {
        console.warn("[Vault] AI aggregation failed, falling back to code-based:", aiErr);
      }

      // Fallback: code-based aggregation
      const newProfile = aggregateProfile(allMeta);
      const finalProfile = mergeWithLockedFields(newProfile);
      await saveCompanyProfile(finalProfile);
      setCompanyProfile(finalProfile);
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
        const detectedCategory = folderUpload ? detectCategory(file) : null;
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

  const [reExtracting, setReExtracting] = useState(false);
  const handleReExtractAll = async () => {
    setReExtracting(true);
    const docs = useVaultStore.getState().documents;
    const extractable = docs.filter((d) => {
      if (d.isOnboardingDoc) return false; // Never re-extract the foundation doc
      const ext = d.name.split(".").pop()?.toLowerCase() || "";
      return ["pdf", "doc", "docx"].includes(ext);
    });

    // Reset all extractable docs to pending
    for (const doc of extractable) {
      updateExtractionStatus(doc.id, "pending");
    }

    // Queue them all
    extractionQueueRef.current = extractable.map((d) => d.id);
    isExtractingRef.current = false;
    await processExtractionQueue();
    setReExtracting(false);
  };

  const filtered =
    activeCategory === "All"
      ? documents
      : documents.filter((d) => d.category === activeCategory);

  const handleResetVault = async () => {
    try {
      await clearAllData();
      // Reset Zustand store
      useVaultStore.setState({
        documents: [],
        companyProfile: null,
        onboardingComplete: false,
        onboardingStep: 0,
      });
      // Clear persisted localStorage
      localStorage.removeItem("company-vault-meta");
      setShowResetConfirm(false);
    } catch (err) {
      console.error("Reset vault failed:", err);
    }
  };

  const categoryCounts = VAULT_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = documents.filter((d) => d.category === cat).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const pendingCount = pendingCategories.length;

  // Show onboarding wizard for new users
  if (isHydrated && !onboardingComplete && documents.length === 0) {
    return <OnboardingWizard />;
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <div className="pt-14 md:pt-0 p-5 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Company Vault
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 max-w-lg">
              Drop your company documents — AI classifies, organizes, and
              extracts key data automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowResetConfirm(true)}
              variant="outline"
              className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-10 px-4"
            >
              <Trash2 size={14} />
              Reset Vault
            </Button>
            {documents.length > 0 && (
              <Button
                onClick={handleReExtractAll}
                disabled={reExtracting}
                variant="outline"
                className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white h-10 px-4"
              >
                <RefreshCw
                  size={14}
                  className={reExtracting ? "animate-spin" : ""}
                />
                {reExtracting ? "Re-extracting..." : "Re-extract All"}
              </Button>
            )}
            <Button
              onClick={() => setShowUpload(true)}
              className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all duration-200 hover:shadow-indigo-500/30 h-10 px-5"
            >
              <Upload size={16} />
              Upload Documents
            </Button>
          </div>
        </div>

        {/* Extraction progress banner */}
        {extractionProgress && (
          <div className="mb-6 px-4 py-4 bg-blue-500/[0.07] border border-blue-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-blue-400 animate-spin" />
                <span className="text-sm font-medium text-blue-300">
                  Extracting metadata: {extractionProgress.done} / {extractionProgress.total}
                  {extractionProgress.failed > 0 && (
                    <span className="text-red-400 ml-2">
                      ({extractionProgress.failed} failed)
                    </span>
                  )}
                </span>
              </div>
              <span className="text-xs text-slate-500 truncate max-w-[200px]">
                {extractionProgress.current}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((extractionProgress.done / extractionProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Pending categorization banner */}
        {pendingCount > 0 && (
          <div className="mb-6 px-4 py-3 bg-indigo-500/[0.07] border border-indigo-500/20 rounded-xl flex items-center gap-3">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg">
              <Sparkles size={16} className="text-indigo-400" />
            </div>
            <p className="text-sm text-indigo-300/80">
              <span className="font-medium text-indigo-300">
                {pendingCount} document{pendingCount > 1 ? "s" : ""}
              </span>{" "}
              need your confirmation on category placement.
            </p>
          </div>
        )}

        {/* Company Profile Card */}
        {companyProfile && companyProfile.companyName && (
          <div className="mb-8 rounded-2xl overflow-hidden border border-slate-700/40 bg-gradient-to-b from-slate-800/60 to-[#0f1729]">
            {/* Profile header band */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600/10 via-purple-600/5 to-transparent border-b border-slate-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/15 rounded-xl flex items-center justify-center ring-1 ring-indigo-500/20">
                    <Building2 size={20} className="text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-white">
                        {companyProfile.companyName}
                      </h2>
                      {companyProfile.entityType && (
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-500/15 text-indigo-400 rounded-full border border-indigo-500/20 font-medium">
                          {companyProfile.entityType}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Aggregated from {documents.length} documents
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshProfile}
                  disabled={refreshingProfile}
                  className="text-slate-400 hover:text-white hover:bg-slate-700/50 h-8 text-xs"
                >
                  <RefreshCw
                    size={13}
                    className={cn(
                      "mr-1.5",
                      refreshingProfile && "animate-spin"
                    )}
                  />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="p-6">
              {/* Key identifiers row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {companyProfile.pan && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                      <Shield size={14} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                        PAN
                      </p>
                      <p className="text-sm text-white font-mono">
                        {companyProfile.pan}
                      </p>
                    </div>
                  </div>
                )}
                {companyProfile.gstin && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                      <Hash size={14} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                        GSTIN
                      </p>
                      <p className="text-sm text-white font-mono">
                        {companyProfile.gstin}
                      </p>
                    </div>
                  </div>
                )}
                {companyProfile.registeredAddress && (
                  <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                      <MapPin size={14} className="text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                        Address
                      </p>
                      <p className="text-sm text-slate-300 truncate">
                        {companyProfile.registeredAddress}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Partners */}
              {companyProfile.partners.length > 0 && (
                <div className="mt-5 pt-5 border-t border-slate-700/30">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Users size={11} />
                    {companyProfile.entityType === "Partnership Firm"
                      ? "Partners"
                      : companyProfile.entityType === "Proprietorship"
                        ? "Proprietor"
                        : companyProfile.entityType === "LLP"
                          ? "Designated Partners"
                          : companyProfile.entityType === "Private Limited" ||
                              companyProfile.entityType === "Public Limited"
                            ? "Directors"
                            : "Partners / Directors"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {companyProfile.partners.map((p) => (
                      <span
                        key={p}
                        className="text-xs px-3 py-1.5 bg-slate-800/80 text-slate-300 rounded-lg border border-slate-700/40"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Turnover */}
              {companyProfile.turnoverHistory.length > 0 && (
                <div className="mt-5 pt-5 border-t border-slate-700/30">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp size={11} />
                    Turnover History
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {companyProfile.turnoverHistory.map((t) => (
                      <div
                        key={t.year}
                        className="bg-slate-800/50 rounded-xl px-4 py-2.5 text-center border border-slate-700/30 min-w-[120px]"
                      >
                        <p className="text-[10px] text-slate-500 uppercase">
                          {t.year}
                        </p>
                        <p className="text-sm text-white font-semibold mt-0.5">
                          {t.amount}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Projects */}
              {companyProfile.pastProjects.length > 0 && (
                <div className="mt-5 pt-5 border-t border-slate-700/30">
                  <button
                    onClick={() => setShowProjects(!showProjects)}
                    className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors group"
                  >
                    <Briefcase size={11} />
                    Past Projects ({companyProfile.totalProjects})
                    {showProjects ? (
                      <ChevronUp
                        size={13}
                        className="text-slate-600 group-hover:text-slate-400"
                      />
                    ) : (
                      <ChevronDown
                        size={13}
                        className="text-slate-600 group-hover:text-slate-400"
                      />
                    )}
                  </button>
                  {showProjects && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {companyProfile.pastProjects.map((proj, i) => (
                        <div
                          key={i}
                          className="bg-slate-800/30 rounded-xl px-4 py-2.5 border border-slate-700/20"
                        >
                          <p className="text-sm text-white font-medium truncate">
                            {proj.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {proj.client} &bull; {proj.value} &bull; {proj.year}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Certifications */}
              {companyProfile.certifications.length > 0 && (
                <div className="mt-5 pt-5 border-t border-slate-700/30">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Award size={11} />
                    Certifications
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {companyProfile.certifications.map((c) => (
                      <span
                        key={c}
                        className="text-xs px-3 py-1.5 bg-emerald-950/30 text-emerald-400 border border-emerald-800/30 rounded-lg"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="mb-6 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex gap-1.5 min-w-max">
            <button
              onClick={() => setActiveCategory("All")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                activeCategory === "All"
                  ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30"
                  : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
              )}
            >
              All{" "}
              <span className="ml-1 text-[10px] opacity-70">
                {documents.length}
              </span>
            </button>
            {VAULT_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] || 0;
              if (count === 0 && activeCategory !== cat) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap",
                    activeCategory === cat
                      ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30"
                      : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
                  )}
                >
                  {cat}{" "}
                  <span className="ml-1 text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-800/60 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-700/30">
              <FolderOpen size={28} className="text-slate-600" />
            </div>
            <p className="text-base font-medium text-slate-400">
              No documents yet
            </p>
            <p className="text-sm text-slate-600 mt-1.5 max-w-sm mx-auto">
              {activeCategory === "All"
                ? "Upload your company documents \u2014 AI will organize them for you."
                : `No documents in \u201C${activeCategory}\u201D.`}
            </p>
            {activeCategory === "All" && (
              <Button
                onClick={() => setShowUpload(true)}
                variant="outline"
                className="mt-5 border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent"
              >
                <Upload size={14} className="mr-2" />
                Upload Documents
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((doc) => {
              const pending = pendingCategories.find(
                (p) => p.docId === doc.id
              );

              return (
                <div
                  key={doc.id}
                  onClick={() => handleOpenDetail(doc)}
                  className={cn(
                    "group rounded-xl p-4 transition-all duration-200 cursor-pointer",
                    "bg-slate-800/30 border hover:bg-slate-800/50",
                    pending
                      ? "border-indigo-500/30 ring-1 ring-indigo-500/10"
                      : "border-slate-700/30 hover:border-slate-600/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-800/60 rounded-lg shrink-0 ring-1 ring-slate-700/30 group-hover:ring-slate-600/40 transition-colors">
                      {getFileIcon(doc.name, 18)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-medium text-slate-200 truncate group-hover:text-white transition-colors"
                        title={doc.name}
                      >
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 rounded text-slate-500">
                          {getFileExtension(doc.name)}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {formatFileSize(doc.fileSize)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-indigo-400/80 bg-indigo-500/[0.07] px-2 py-0.5 rounded-md truncate max-w-[120px] border border-indigo-500/10">
                        {doc.category}
                      </span>
                      <ExtractionBadge status={doc.extractionStatus} />
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.extractionStatus === "failed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetryExtraction(doc.id);
                          }}
                          className="p-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Retry extraction"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(doc);
                        }}
                        className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="Preview & Metadata"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDocument(doc.id);
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
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
            onDelete={(id) => {
              removeDocument(id);
              setSelectedDoc(null);
            }}
            onRetry={handleRetryExtraction}
          />
        )}

        {/* Upload modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f1729] border border-slate-700/50 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-5 border-b border-slate-700/30">
                <h2 className="text-base font-semibold text-white">
                  Upload Documents
                </h2>
                <button
                  onClick={() => setShowUpload(false)}
                  className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5">
                {/* AI clerk info */}
                <div className="mb-5 p-3.5 bg-indigo-500/[0.06] border border-indigo-500/15 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1 bg-indigo-500/10 rounded-md mt-0.5">
                      <Sparkles
                        size={14}
                        className="text-indigo-400"
                      />
                    </div>
                    <p className="text-sm text-indigo-300/70 leading-relaxed">
                      Just drop your files — AI will read each document,
                      classify it into the right category, and extract company
                      metadata automatically.
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
                    "border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200",
                    dragOver
                      ? "border-indigo-500 bg-indigo-500/[0.07] scale-[1.01]"
                      : "border-slate-700/50 hover:border-slate-600/50"
                  )}
                >
                  <div className="w-12 h-12 bg-slate-800/80 rounded-xl flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-700/30">
                    <Upload size={22} className="text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    Drag & drop files here, or choose below
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!!uploadProgress}
                      className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 bg-transparent text-xs h-9"
                    >
                      <FileText size={13} className="mr-1.5" />
                      Select Files
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={!!uploadProgress}
                      className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 bg-transparent text-xs h-9"
                    >
                      <FolderOpen size={13} className="mr-1.5" />
                      Select Folder
                    </Button>
                  </div>

                  {uploadProgress && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                        <span className="truncate max-w-[70%]">
                          {uploadProgress.fileName}
                        </span>
                        <span className="font-mono">
                          {uploadProgress.current} / {uploadProgress.total}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-300"
                          style={{
                            width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 mt-4 text-center">
                  PDF, DOC, DOCX, XLS, XLSX, CSV, ZIP, RAR, JPG, PNG supported
                </p>
              </div>

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
                      const ext =
                        f.name.split(".").pop()?.toLowerCase() || "";
                      return [
                        "pdf",
                        "doc",
                        "docx",
                        "xls",
                        "xlsx",
                        "csv",
                        "zip",
                        "rar",
                        "jpg",
                        "jpeg",
                        "png",
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

      {/* Reset Vault Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Reset Vault</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              This will permanently delete all documents, metadata, and your
              company profile. You&apos;ll go through onboarding again.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetVault}
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                Delete Everything
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

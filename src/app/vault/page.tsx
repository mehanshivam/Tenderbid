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
import { formatFileSize, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveFile, getFile, saveMetadata, getAllMetadata, saveCompanyProfile } from "@/lib/vaultDB";
import { migrateVaultIfNeeded } from "@/lib/vaultMigration";
import { extractTextFromBlob } from "@/lib/extractText";
import { aggregateProfile } from "@/lib/aggregateProfile";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.jpg,.jpeg,.png";

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
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!path) return null;
  const parts = path.split("/");
  // Check from deepest subfolder up to root
  for (let i = parts.length - 2; i >= 0; i--) {
    const folder = parts[i].toLowerCase().trim();
    if (FOLDER_CATEGORY_MAP[folder]) {
      return FOLDER_CATEGORY_MAP[folder];
    }
  }
  return null;
}

function ExtractionBadge({ status }: { status: VaultDocumentMeta["extractionStatus"] }) {
  switch (status) {
    case "extracting":
      return (
        <span className="flex items-center gap-1 text-xs text-amber-400">
          <Loader2 size={12} className="animate-spin" /> Extracting
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 size={12} /> Extracted
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
          <div className="w-2 h-2 rounded-full bg-slate-500" /> Pending
        </span>
      );
  }
}

export default function VaultPage() {
  const {
    documents,
    companyProfile,
    addDocument,
    addDocuments,
    removeDocument,
    updateExtractionStatus,
    setCompanyProfile,
  } = useVaultStore();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<VaultCategory>(VAULT_CATEGORIES[0]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
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

  // ─── Metadata Extraction Queue ───

  const processExtractionQueue = useCallback(async () => {
    if (isExtractingRef.current) return;
    isExtractingRef.current = true;

    while (extractionQueueRef.current.length > 0) {
      // Process up to 3 concurrently
      const batch = extractionQueueRef.current.splice(0, 3);

      await Promise.allSettled(
        batch.map(async (docId) => {
          const doc = useVaultStore.getState().documents.find((d) => d.id === docId);
          if (!doc) return;

          const ext = doc.name.split(".").pop()?.toLowerCase() || "";
          if (ext !== "pdf") {
            // Non-PDF: mark as done with no metadata
            updateExtractionStatus(docId, "done");
            return;
          }

          try {
            updateExtractionStatus(docId, "extracting");

            // Get blob from IndexedDB
            const blob = await getFile(docId);
            if (!blob) {
              updateExtractionStatus(docId, "failed");
              return;
            }

            // Extract text client-side
            const text = await extractTextFromBlob(blob, ext);
            if (!text || text.length < 50) {
              // Not enough text to extract metadata
              updateExtractionStatus(docId, "done");
              await saveMetadata(docId, {}, "done");
              return;
            }

            // Call AI extraction API
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

            // Save metadata to IndexedDB
            await saveMetadata(docId, metadata, "done");
            updateExtractionStatus(docId, "done");
          } catch (err) {
            console.error(`[Vault] Extraction failed for ${doc.name}:`, err);
            updateExtractionStatus(docId, "failed");
          }
        })
      );
    }

    isExtractingRef.current = false;

    // After all extractions, re-aggregate company profile
    await refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateExtractionStatus]);

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

        // Auto-detect category from folder structure
        const detectedCategory = folderUpload ? detectCategory(file) : null;
        const category = detectedCategory || uploadCategory;

        // Save blob to IndexedDB
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

      // Add all docs to store at once
      addDocuments(newDocs);
      setUploadProgress(null);
      setShowUpload(false);

      // Start background extraction
      processExtractionQueue();
    },
    [uploadCategory, addDocuments, processExtractionQueue]
  );

  const handleRetryExtraction = useCallback(
    (docId: string) => {
      extractionQueueRef.current.push(docId);
      processExtractionQueue();
    },
    [processExtractionQueue]
  );

  const handlePreview = async (doc: VaultDocumentMeta) => {
    try {
      const blob = await getFile(doc.id);
      if (!blob) {
        alert("File not found in storage.");
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Cleanup after a delay
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      console.error("Preview failed:", err);
    }
  };

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Company Vault</h1>
          <p className="text-sm text-slate-400 mt-1">
            Store and organize your company documents. AI automatically extracts
            key metadata for bid preparation.
          </p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          <Upload size={16} />
          Upload Files
        </Button>
      </div>

      {/* Company Profile Card */}
      {companyProfile && companyProfile.companyName && (
        <div className="mb-6 bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={20} className="text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Company Profile</h2>
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
            {/* Company Name */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Company Name</p>
              <p className="text-sm text-white font-medium">{companyProfile.companyName}</p>
            </div>

            {/* PAN */}
            {companyProfile.pan && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">PAN</p>
                <p className="text-sm text-white font-mono">{companyProfile.pan}</p>
              </div>
            )}

            {/* GSTIN */}
            {companyProfile.gstin && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">GSTIN</p>
                <p className="text-sm text-white font-mono">{companyProfile.gstin}</p>
              </div>
            )}

            {/* Address */}
            {companyProfile.registeredAddress && (
              <div className="md:col-span-2 lg:col-span-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Registered Address</p>
                <p className="text-sm text-slate-300">{companyProfile.registeredAddress}</p>
              </div>
            )}
          </div>

          {/* Partners */}
          {companyProfile.partners.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Partners / Directors</p>
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

          {/* Turnover */}
          {companyProfile.turnoverHistory.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Turnover History</p>
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

          {/* Past Projects Summary */}
          {companyProfile.pastProjects.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowProjects(!showProjects)}
                className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors"
              >
                Past Projects ({companyProfile.totalProjects})
                {showProjects ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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

          {/* Certifications */}
          {companyProfile.certifications.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Certifications</p>
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
          <p className="text-lg font-medium text-slate-400">No documents yet</p>
          <p className="text-sm mt-1">
            {activeCategory === "All"
              ? "Upload your company documents to get started."
              : `No documents in "${activeCategory}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors group"
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
                      onClick={() => handleRetryExtraction(doc.id)}
                      className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="Retry extraction"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handlePreview(doc)}
                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                    title="Preview / Download"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Upload Documents</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 hover:bg-slate-700 rounded-lg text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Category selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Category{" "}
                <span className="text-slate-500 font-normal">
                  (auto-detected for folder uploads)
                </span>
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as VaultCategory)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {VAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
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
                Drag & drop files here, or choose an option below
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

              {/* Upload progress */}
              {uploadProgress && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="truncate max-w-[70%]">{uploadProgress.fileName}</span>
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
              Supports PDF, DOC, DOCX, XLS, XLSX, CSV, ZIP, RAR, JPG, PNG. AI
              metadata extraction runs automatically for PDF files.
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
                      "pdf", "doc", "docx", "xls", "xlsx", "csv",
                      "zip", "rar", "jpg", "jpeg", "png",
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

"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  FolderOpen,
  AlertTriangle,
  X,
  File,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVaultStore } from "@/store/vaultStore";
import { VAULT_CATEGORIES, type VaultCategory } from "@/lib/types";
import { formatFileSize, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.jpg,.jpeg,.png";
const MAX_STORAGE_BYTES = 4.5 * 1024 * 1024; // ~4.5MB to leave buffer

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getFileIcon(fileType: string) {
  if (fileType.includes("pdf")) return <FileText size={20} className="text-red-500" />;
  if (fileType.includes("sheet") || fileType.includes("excel") || fileType.includes("csv") || fileType.includes("xls"))
    return <FileSpreadsheet size={20} className="text-green-500" />;
  if (fileType.includes("word") || fileType.includes("doc"))
    return <FileText size={20} className="text-blue-500" />;
  return <File size={20} className="text-gray-500" />;
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toUpperCase() || "FILE";
}

export default function VaultPage() {
  const { documents, addDocument, removeDocument, storageUsed } = useVaultStore();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<VaultCategory>(VAULT_CATEGORIES[0]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const currentUsage = storageUsed();
  const usagePercent = Math.min((currentUsage / MAX_STORAGE_BYTES) * 100, 100);
  const isNearLimit = usagePercent > 80;

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

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      try {
        const fileArray = Array.from(files);
        for (const file of fileArray) {
          const base64 = await fileToBase64(file);
          if (currentUsage + base64.length > MAX_STORAGE_BYTES) {
            alert(
              `Storage limit reached. Cannot add "${file.name}". Try removing some documents first.`
            );
            break;
          }
          addDocument({
            id: crypto.randomUUID(),
            name: file.name,
            category: uploadCategory,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
            base64Data: base64,
            uploadedAt: new Date().toISOString(),
          });
        }
      } finally {
        setUploading(false);
        setShowUpload(false);
      }
    },
    [addDocument, uploadCategory, currentUsage]
  );

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

  const handlePreview = (doc: { base64Data: string; name: string }) => {
    const link = document.createElement("a");
    link.href = doc.base64Data;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.download = doc.name;
    link.click();
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Vault</h1>
          <p className="text-sm text-gray-500 mt-1">
            Store and organize your company documents for quick access during bid preparation.
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="gap-2">
          <Upload size={16} />
          Upload Files
        </Button>
      </div>

      {/* Storage indicator */}
      <div className="mb-6 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-600">
            Storage: {formatFileSize(currentUsage)} / {formatFileSize(MAX_STORAGE_BYTES)}
          </span>
          <span className={cn("font-medium", isNearLimit ? "text-amber-600" : "text-gray-500")}>
            {usagePercent.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isNearLimit ? "bg-amber-500" : "bg-indigo-500"
            )}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        {isNearLimit && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-2">
            <AlertTriangle size={12} />
            Storage is getting full. Consider removing unused documents.
          </p>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory("All")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            activeCategory === "All"
              ? "bg-indigo-100 text-indigo-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                ? "bg-indigo-100 text-indigo-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {cat} ({categoryCounts[cat] || 0})
          </button>
        ))}
      </div>

      {/* Document grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No documents yet</p>
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
              className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-50 rounded-lg shrink-0">
                  {getFileIcon(doc.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={doc.name}>
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                      {getFileExtension(doc.name)}
                    </span>
                    <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(doc.uploadedAt)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full truncate max-w-[60%]">
                  {doc.category}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handlePreview(doc)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Preview / Download"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload Documents</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Category selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as VaultCategory)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                dragOver ? "border-indigo-500 bg-indigo-50" : "border-gray-300"
              )}
            >
              <Upload size={32} className="mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-600 mb-3">
                Drag & drop files here, or choose an option below
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <FileText size={14} className="mr-1.5" />
                  Select Files
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={uploading}
                >
                  <FolderOpen size={14} className="mr-1.5" />
                  Select Folder
                </Button>
              </div>
              {uploading && (
                <p className="text-sm text-indigo-600 mt-3">Uploading...</p>
              )}
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
                    const ext = f.name.split(".").pop()?.toLowerCase() || "";
                    return ["pdf", "doc", "docx", "xls", "xlsx", "csv", "zip", "rar", "jpg", "jpeg", "png"].includes(ext);
                  });
                  handleFiles(supported);
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

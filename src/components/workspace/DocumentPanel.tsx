"use client";

import { FileText, FileArchive, FileSpreadsheet, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/format";
import { getDocumentDownloadUrl } from "@/lib/api";
import type { TenderDocument } from "@/lib/types";

interface DocumentPanelProps {
  documents: TenderDocument[];
  selectedDocId: number | null;
  onSelectDocument: (doc: TenderDocument) => void;
  isLoading: boolean;
}

function getFileIcon(fileType: string) {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return FileText;
    case "zip":
    case "rar":
      return FileArchive;
    case "xls":
    case "xlsx":
    case "csv":
      return FileSpreadsheet;
    default:
      return FileText;
  }
}

function getFileColor(fileType: string) {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return "text-red-500";
    case "zip":
    case "rar":
      return "text-yellow-600";
    case "xls":
    case "xlsx":
      return "text-green-600";
    default:
      return "text-gray-500";
  }
}

export function DocumentPanel({
  documents,
  selectedDocId,
  onSelectDocument,
  isLoading,
}: DocumentPanelProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Documents
        </h3>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <FileText size={24} className="mx-auto mb-2" />
        <p className="text-sm">No documents available</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
        Documents ({documents.length})
      </h3>
      <div className="space-y-1">
        {documents.map((doc) => {
          const Icon = getFileIcon(doc.file_type);
          const colorClass = getFileColor(doc.file_type);
          const isSelected = selectedDocId === doc.id;
          const isPdf = doc.file_type.toLowerCase() === "pdf";

          return (
            <div
              key={doc.id}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors group",
                isSelected
                  ? "bg-indigo-50 border border-indigo-200"
                  : "hover:bg-gray-50 border border-transparent"
              )}
              onClick={() => onSelectDocument(doc)}
            >
              <Icon size={18} className={colorClass} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {doc.filename}
                </p>
                <p className="text-xs text-gray-400">
                  {doc.file_type.toUpperCase()} &middot;{" "}
                  {formatFileSize(doc.file_size)}
                </p>
              </div>
              {!isPdf && (
                <a
                  href={getDocumentDownloadUrl(doc.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Download"
                >
                  <Download size={14} className="text-gray-400 hover:text-gray-600" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

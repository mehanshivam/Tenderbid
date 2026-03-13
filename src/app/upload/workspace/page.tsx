"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChatInterface } from "@/components/workspace/ChatInterface";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";
import { useUploadStore } from "@/stores/uploadStore";
import { formatFileSize } from "@/lib/format";
import {
  ArrowLeft,
  FileText,
  FileArchive,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UploadedFile, TenderDocument } from "@/lib/types";

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

// Map UploadedFile to TenderDocument shape for PreviewPanel compatibility
function toTenderDoc(file: UploadedFile): TenderDocument {
  return {
    id: 0,
    tender_id: "upload",
    portal_id: "upload",
    filename: file.name,
    file_size: file.size,
    file_type: file.type,
    checksum: null,
    downloaded_at: new Date().toISOString(),
  };
}

export default function UploadWorkspacePage() {
  const router = useRouter();
  const { files, tenderName } = useUploadStore();

  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [targetPage, setTargetPage] = useState<{
    page: number;
    ts: number;
  } | null>(null);

  // Redirect if no files uploaded
  useEffect(() => {
    if (files.length === 0) {
      router.replace("/upload");
    }
  }, [files, router]);

  const handleTextExtracted = useCallback((text: string) => {
    setDocumentText(text);
  }, []);

  const handleCitationClick = useCallback((page: number) => {
    setTargetPage({ page, ts: Date.now() });
  }, []);

  if (files.length === 0) return null;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/upload">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={16} className="mr-1" />
              Back
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 line-clamp-1">
            {tenderName}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Upload size={14} />
              Uploaded
            </span>
            <span className="flex items-center gap-1">
              <FileText size={14} />
              {files.length} Document{files.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-[380px] shrink-0 flex flex-col bg-white border-r border-gray-200">
          {/* Document list */}
          <div className="shrink-0 max-h-[45%] overflow-y-auto border-b border-gray-100">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                Documents ({files.length})
              </h3>
              <div className="space-y-1">
                {files.map((file) => {
                  const Icon = getFileIcon(file.type);
                  const colorClass = getFileColor(file.type);
                  const isSelected = selectedFile?.id === file.id;

                  return (
                    <div
                      key={file.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                        isSelected
                          ? "bg-indigo-50 border border-indigo-200"
                          : "hover:bg-gray-50 border border-transparent"
                      )}
                      onClick={() => setSelectedFile(file)}
                    >
                      <Icon size={18} className={colorClass} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {file.type.toUpperCase()} &middot;{" "}
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatInterface
              tenderId="upload"
              documentContext={documentText}
              onCitationClick={handleCitationClick}
            />
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 bg-white">
          {selectedFile ? (
            <PreviewPanel
              document={toTenderDoc(selectedFile)}
              onTextExtracted={handleTextExtracted}
              targetPage={targetPage}
              documentText={documentText}
              onCitationClick={handleCitationClick}
              pdfUrl={selectedFile.blobUrl}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  Select a document to preview
                </p>
                <p className="text-xs mt-1">
                  Click on a document from the left panel
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

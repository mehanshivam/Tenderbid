"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Download, FileArchive, FileSpreadsheet, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import { getDocumentDownloadUrl } from "@/lib/api";
import { FormsPanel } from "./FormsPanel";
import type { TenderDocument } from "@/lib/types";

const PdfViewer = dynamic(
  () => import("./PdfViewer").then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    ),
  }
);

interface PreviewPanelProps {
  document: TenderDocument | null;
  onTextExtracted?: (text: string) => void;
  targetPage?: { page: number; ts: number } | null;
  highlightText?: string | null;
  documentText?: string;
  onCitationClick?: (page: number) => void;
  pdfUrl?: string;
}

export function PreviewPanel({
  document,
  onTextExtracted,
  targetPage,
  highlightText,
  documentText,
  onCitationClick,
  pdfUrl,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "forms">("preview");

  if (!document) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <Eye size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Select a document to preview</p>
          <p className="text-xs mt-1">
            Click on a document from the left panel
          </p>
        </div>
      </div>
    );
  }

  const isPdf = document.file_type.toLowerCase() === "pdf";
  const downloadUrl = pdfUrl || getDocumentDownloadUrl(document.id);

  if (!isPdf) {
    const Icon =
      document.file_type.toLowerCase() === "zip"
        ? FileArchive
        : FileSpreadsheet;

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-gray-50 rounded-xl max-w-sm">
          <Icon size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="font-medium text-gray-800 mb-1">
            {document.filename}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {document.file_type.toUpperCase()} &middot;{" "}
            {formatFileSize(document.file_size)}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Preview is not available for this file type
          </p>
          <a href={downloadUrl}>
            <Button>
              <Download size={16} className="mr-2" />
              Download File
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab("preview")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "preview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => setActiveTab("forms")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "forms"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Forms & Annexures
        </button>
      </div>

      {/* Content — both tabs stay mounted to preserve state */}
      <div className="flex-1 min-h-0 relative">
        <div className={`h-full ${activeTab !== "preview" ? "hidden" : ""}`}>
          <PdfViewer
            url={downloadUrl}
            onTextExtracted={onTextExtracted}
            targetPage={targetPage}
            highlightText={highlightText}
          />
        </div>
        <div className={`h-full ${activeTab !== "forms" ? "hidden" : ""}`}>
          <FormsPanel
            documentText={documentText || ""}
            onCitationClick={onCitationClick}
          />
        </div>
      </div>
    </div>
  );
}

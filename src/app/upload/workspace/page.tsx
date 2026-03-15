"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChatInterface } from "@/components/workspace/ChatInterface";
import { WorkflowPanel } from "@/components/workspace/WorkflowPanel";
import { useUploadStore } from "@/stores/uploadStore";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { UploadedFile } from "@/lib/types";

const PdfViewer = dynamic(
  () => import("@/components/workspace/PdfViewer").then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    ),
  }
);

export default function UploadWorkspacePage() {
  const router = useRouter();
  const { files, tenderName } = useUploadStore();

  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [targetPage, setTargetPage] = useState<{
    page: number;
    ts: number;
  } | null>(null);

  // Redirect if no files uploaded, auto-select first PDF
  useEffect(() => {
    if (files.length === 0) {
      router.replace("/upload");
    } else if (!selectedFile) {
      const pdf = files.find((f) => f.type.toLowerCase() === "pdf");
      setSelectedFile(pdf || files[0]);
    }
  }, [files, router, selectedFile]);

  const handleTextExtracted = useCallback((text: string) => {
    setDocumentText(text);
  }, []);

  const handleCitationClick = useCallback((page: number) => {
    setTargetPage({ page, ts: Date.now() });
  }, []);

  const handlePreviewPages = useCallback((pages: number[]) => {
    if (pages.length > 0) {
      setTargetPage({ page: pages[0], ts: Date.now() });
    }
  }, []);

  if (files.length === 0) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Compact Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-2">
        <Link href="/upload">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
            <ArrowLeft size={12} className="mr-0.5" />
            Back
          </Button>
        </Link>
        <div className="w-px h-4 bg-gray-200" />
        <span className="text-xs font-medium text-gray-600 truncate">
          {tenderName}
        </span>
      </div>

      {/* 3-Panel Workspace */}
      <div className="flex-1 min-h-0">
        <Group orientation="horizontal" className="flex h-full w-full">
          {/* Left: Workflow Panel */}
          <Panel id="workflow" defaultSize="30%" minSize="22%" maxSize="40%">
            <div className="h-full overflow-hidden">
              <WorkflowPanel
                tenderName={tenderName}
                fileCount={files.length}
                documentText={documentText}
                onPreviewPages={handlePreviewPages}
              />
            </div>
          </Panel>

          <Separator className="w-px bg-gray-200" />

          {/* Center: Document Viewer */}
          <Panel id="viewer" defaultSize="45%" minSize="30%">
            <div className="h-full overflow-hidden bg-white">
              {selectedFile ? (
                <PdfViewer
                  url={selectedFile.blobUrl}
                  onTextExtracted={handleTextExtracted}
                  targetPage={targetPage}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="text-sm">No document to preview</p>
                </div>
              )}
            </div>
          </Panel>

          <Separator className="w-px bg-gray-200" />

          {/* Right: AI Chat */}
          <Panel id="chat" defaultSize="25%" minSize="18%" maxSize="35%">
            <div className="h-full overflow-hidden bg-white border-l border-gray-200">
              <ChatInterface
                tenderId="upload"
                documentContext={documentText}
                onCitationClick={handleCitationClick}
              />
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}

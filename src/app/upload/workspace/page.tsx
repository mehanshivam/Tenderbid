"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChatInterface } from "@/components/workspace/ChatInterface";
import { WorkflowPanel } from "@/components/workspace/WorkflowPanel";
import { FormEditor } from "@/components/workspace/FormEditor";
import { useUploadStore } from "@/stores/uploadStore";
import { ArrowLeft, X, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { UploadedFile, ExtractedForm, BidChecklistItem } from "@/lib/types";

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

interface OpenTab {
  id: string;
  title: string;
  form: ExtractedForm;
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

  // Form extraction state
  const [extractedForms, setExtractedForms] = useState<ExtractedForm[]>([]);
  const formsExtractedRef = useRef(false);

  // Tab state for center panel
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<"preview" | string>("preview");

  // Redirect if no files uploaded, auto-select first PDF
  useEffect(() => {
    if (files.length === 0) {
      router.replace("/upload");
    } else if (!selectedFile) {
      const pdf = files.find((f) => f.type.toLowerCase() === "pdf");
      setSelectedFile(pdf || files[0]);
    }
  }, [files, router, selectedFile]);

  // Auto-extract forms when document text becomes available
  useEffect(() => {
    if (!documentText || formsExtractedRef.current) return;
    formsExtractedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/extract-forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentContext: documentText }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const forms = (data.forms || []).map((f: ExtractedForm, i: number) => ({
          ...f,
          id: `form-${i}`,
        }));
        setExtractedForms(forms);
      } catch {
        // Silent fail — forms are a bonus feature
      }
    })();
  }, [documentText]);

  const handleTextExtracted = useCallback((text: string) => {
    setDocumentText(text);
  }, []);

  const handleCitationClick = useCallback((page: number) => {
    setActiveTab("preview");
    setTargetPage({ page, ts: Date.now() });
  }, []);

  // Eye icon handler: open annexure tabs or fall back to PDF page
  const handlePreviewItem = useCallback(
    (item: BidChecklistItem) => {
      // Parse annexure references from name and particular text
      const searchText = `${item.name} ${item.particular}`;
      const annexurePattern = /Annexure[-\s]?(\d+)/gi;
      const matches: string[] = [];
      let match;
      while ((match = annexurePattern.exec(searchText)) !== null) {
        matches.push(match[1]);
      }

      if (matches.length > 0 && extractedForms.length > 0) {
        // Find matching extracted forms
        const matchedForms = matches
          .map((num) => {
            return extractedForms.find((f) =>
              new RegExp(`Annexure[-\\s]?${num}\\b`, "i").test(f.title)
            );
          })
          .filter((f): f is ExtractedForm => f !== undefined);

        if (matchedForms.length > 0) {
          setOpenTabs((prev) => {
            const newTabs = [...prev];
            for (const form of matchedForms) {
              if (!newTabs.find((t) => t.id === form.id)) {
                newTabs.push({ id: form.id, title: form.title, form });
              }
            }
            return newTabs;
          });
          setActiveTab(matchedForms[0].id);
          return;
        }
      }

      // Fallback: jump PDF to source page
      if (item.sourcePages.length > 0) {
        setActiveTab("preview");
        setTargetPage({ page: item.sourcePages[0], ts: Date.now() });
      }
    },
    [extractedForms]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => prev.filter((t) => t.id !== tabId));
      if (activeTab === tabId) {
        setActiveTab("preview");
      }
    },
    [activeTab]
  );

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
                onPreviewItem={handlePreviewItem}
              />
            </div>
          </Panel>

          <Separator className="w-px bg-gray-200" />

          {/* Center: Document Viewer + Annexure Tabs */}
          <Panel id="viewer" defaultSize="45%" minSize="30%">
            <div className="h-full overflow-hidden bg-white flex flex-col">
              {/* Tab bar — only shown when there are open form tabs */}
              {openTabs.length > 0 && (
                <div className="shrink-0 flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                      activeTab === "preview"
                        ? "border-indigo-600 text-indigo-600 bg-white"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Eye size={12} />
                    Preview
                  </button>
                  {openTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 group ${
                        activeTab === tab.id
                          ? "border-indigo-600 text-indigo-600 bg-white"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <FileText size={12} />
                      <span className="max-w-[120px] truncate">{tab.title}</span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab.id);
                        }}
                        className="ml-1 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                      >
                        <X size={10} />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Content area */}
              <div className="flex-1 min-h-0 relative">
                {/* PDF Viewer — always mounted */}
                <div className={`h-full ${activeTab !== "preview" ? "hidden" : ""}`}>
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

                {/* Form editors — mounted when tab is open */}
                {openTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`h-full overflow-y-auto ${activeTab !== tab.id ? "hidden" : ""}`}
                  >
                    <FormEditor
                      form={tab.form}
                      onCitationClick={handleCitationClick}
                    />
                  </div>
                ))}
              </div>
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

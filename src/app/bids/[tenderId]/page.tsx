"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChatInterface } from "@/components/workspace/ChatInterface";
import { WorkflowPanel } from "@/components/workspace/WorkflowPanel";
import { FormEditor } from "@/components/workspace/FormEditor";
import { SaveBidButton } from "@/components/my-bids/SaveBidButton";
import { useTenderDetail, useTenderDocuments } from "@/hooks/useTenders";
import { getDocumentDownloadUrl } from "@/lib/api";
import { formatCurrency, formatDate, daysLeft } from "@/lib/format";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  IndianRupee,
  FileText,
  Eye,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { TenderDocument, ExtractedForm, BidChecklistItem } from "@/lib/types";

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

export default function TenderWorkspacePage() {
  const params = useParams();
  const tenderId = decodeURIComponent(params.tenderId as string);

  const { data: tender, isLoading: tenderLoading } = useTenderDetail(tenderId);
  const { data: documents, isLoading: docsLoading } = useTenderDocuments(tenderId);

  const [selectedDoc, setSelectedDoc] = useState<TenderDocument | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [targetPage, setTargetPage] = useState<{ page: number; ts: number } | null>(null);

  // Form extraction state
  const [extractedForms, setExtractedForms] = useState<ExtractedForm[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const formsExtractedRef = useRef(false);

  // Tab state for center panel
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<"preview" | string>("preview");

  // Auto-select first PDF document
  useEffect(() => {
    if (!selectedDoc && documents && documents.length > 0) {
      const pdf = documents.find((d) => d.file_type.toLowerCase() === "pdf");
      setSelectedDoc(pdf || documents[0]);
    }
  }, [documents, selectedDoc]);

  // Reset state when selected document changes
  const prevDocRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedDoc && selectedDoc.id !== prevDocRef.current) {
      prevDocRef.current = selectedDoc.id;
      setDocumentText("");
      setExtractedForms([]);
      formsExtractedRef.current = false;
      setOpenTabs([]);
      setActiveTab("preview");
    }
  }, [selectedDoc]);

  // Auto-extract forms when document text becomes available
  useEffect(() => {
    if (!documentText || formsExtractedRef.current) return;
    formsExtractedRef.current = true;
    setIsExtracting(true);

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
      } finally {
        setIsExtracting(false);
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

  // Open a specific extracted form in a center panel tab
  const handleOpenForm = useCallback((form: ExtractedForm) => {
    setOpenTabs((prev) => {
      if (prev.find((t) => t.id === form.id)) {
        setActiveTab(form.id);
        return prev;
      }
      return [...prev, { id: form.id, title: form.title, form }];
    });
    setActiveTab(form.id);
  }, []);

  // Fallback: jump to PDF page for items without a matched form
  const handlePreviewItem = useCallback((item: BidChecklistItem) => {
    if (item.sourcePages.length > 0) {
      setActiveTab("preview");
      setTargetPage({ page: item.sourcePages[0], ts: Date.now() });
    }
  }, []);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => prev.filter((t) => t.id !== tabId));
      if (activeTab === tabId) {
        setActiveTab("preview");
      }
    },
    [activeTab]
  );

  const days = tender ? daysLeft(tender.closing_date) : 0;
  const pdfUrl = selectedDoc ? getDocumentDownloadUrl(selectedDoc.id) : null;
  const tenderTitle = tender?.title || tenderId;
  const docCount = documents?.length || 0;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Compact Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-2">
        <Link href="/bids">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
            <ArrowLeft size={12} className="mr-0.5" />
            Back
          </Button>
        </Link>
        <div className="w-px h-4 bg-gray-200" />

        {tenderLoading ? (
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
        ) : tender ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-medium text-gray-600 truncate max-w-[300px]">
              {tender.title}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-gray-400">
              <span className="flex items-center gap-0.5">
                <Building2 size={10} />
                {tender.organisation_name}
              </span>
              {tender.state_name && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={10} />
                  {tender.state_name}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Calendar size={10} />
                {formatDate(tender.closing_date)}
              </span>
              <Badge
                variant={days <= 7 ? "destructive" : "default"}
                className="text-[9px] h-4 px-1"
              >
                {days > 0 ? `${days}d` : "Expired"}
              </Badge>
              {tender.emd_amount && (
                <span className="flex items-center gap-0.5">
                  <IndianRupee size={10} />
                  EMD: {formatCurrency(tender.emd_amount)}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <FileText size={10} />
                {tender.document_count} Docs
              </span>
            </div>
            <div className="ml-auto shrink-0">
              <SaveBidButton tender={tender} />
            </div>
          </div>
        ) : null}
      </div>

      {/* 3-Panel Workspace */}
      <div className="flex-1 min-h-0">
        <Group orientation="horizontal" className="flex h-full w-full">
          {/* Left: Workflow Panel */}
          <Panel id="workflow" defaultSize="30%" minSize="22%" maxSize="40%">
            <div className="h-full overflow-hidden">
              {docsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                </div>
              ) : (
                <WorkflowPanel
                  tenderName={tenderTitle}
                  fileCount={docCount}
                  documentText={documentText}
                  extractedForms={extractedForms}
                  isExtracting={isExtracting}
                  onPreviewItem={handlePreviewItem}
                  onOpenForm={handleOpenForm}
                />
              )}
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
                  {pdfUrl ? (
                    <PdfViewer
                      url={pdfUrl}
                      onTextExtracted={handleTextExtracted}
                      targetPage={targetPage}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p className="text-sm">
                        {docsLoading ? "Loading documents..." : "No document to preview"}
                      </p>
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
                key={selectedDoc?.id ?? "none"}
                tenderId={tenderId}
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

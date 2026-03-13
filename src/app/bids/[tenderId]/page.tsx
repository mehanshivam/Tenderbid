"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DocumentPanel } from "@/components/workspace/DocumentPanel";
import { ChatInterface } from "@/components/workspace/ChatInterface";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";
import { SaveBidButton } from "@/components/my-bids/SaveBidButton";
import { useTenderDetail, useTenderDocuments } from "@/hooks/useTenders";
import { formatCurrency, formatDate, daysLeft } from "@/lib/format";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  IndianRupee,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TenderDocument } from "@/lib/types";

export default function TenderWorkspacePage() {
  const params = useParams();
  const tenderId = decodeURIComponent(params.tenderId as string);

  const { data: tender, isLoading: tenderLoading } = useTenderDetail(tenderId);
  const { data: documents, isLoading: docsLoading } =
    useTenderDocuments(tenderId);

  const [selectedDoc, setSelectedDoc] = useState<TenderDocument | null>(null);
  const [documentText, setDocumentText] = useState<string>("");
  const [targetPage, setTargetPage] = useState<{ page: number; ts: number } | null>(null);

  const handleSelectDocument = useCallback((doc: TenderDocument) => {
    setSelectedDoc(doc);
  }, []);

  const handleTextExtracted = useCallback((text: string) => {
    setDocumentText(text);
  }, []);

  const handleCitationClick = useCallback((page: number) => {
    setTargetPage({ page, ts: Date.now() });
  }, []);

  const days = tender ? daysLeft(tender.closing_date) : 0;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/bids">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={16} className="mr-1" />
              Back
            </Button>
          </Link>
          {tender && <SaveBidButton tender={tender} />}
        </div>

        {tenderLoading ? (
          <div className="space-y-2">
            <div className="h-6 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : tender ? (
          <div>
            <h1 className="text-lg font-bold text-gray-900 line-clamp-1">
              {tender.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Building2 size={14} />
                {tender.organisation_name}
              </span>
              {tender.state_name && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {tender.state_name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                Closes: {formatDate(tender.closing_date)}
              </span>
              <Badge
                variant={days <= 7 ? "destructive" : "default"}
                className="text-xs"
              >
                {days > 0 ? `${days} Days Left` : "Expired"}
              </Badge>
              {tender.emd_amount && (
                <span className="flex items-center gap-1">
                  <IndianRupee size={14} />
                  EMD: {formatCurrency(tender.emd_amount)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <FileText size={14} />
                {tender.document_count} Documents
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Workspace - simple flex layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Documents + Chat */}
        <div className="w-[380px] shrink-0 flex flex-col bg-white border-r border-gray-200">
          {/* Documents section */}
          <div className="shrink-0 max-h-[45%] overflow-y-auto border-b border-gray-100">
            <DocumentPanel
              documents={documents || []}
              selectedDocId={selectedDoc?.id || null}
              onSelectDocument={handleSelectDocument}
              isLoading={docsLoading}
            />
          </div>

          {/* Chat section */}
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatInterface
              tenderId={tenderId}
              documentContext={documentText}
              onCitationClick={handleCitationClick}
            />
          </div>
        </div>

        {/* Right Panel: Document Preview */}
        <div className="flex-1 bg-white">
          <PreviewPanel
            document={selectedDoc}
            onTextExtracted={handleTextExtracted}
            targetPage={targetPage}
            documentText={documentText}
            onCitationClick={handleCitationClick}
          />
        </div>
      </div>
    </div>
  );
}

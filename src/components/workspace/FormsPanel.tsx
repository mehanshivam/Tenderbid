"use client";

import { useState, useEffect, useRef } from "react";
import { FormEditor } from "./FormEditor";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, RefreshCw } from "lucide-react";
import type { ExtractedForm } from "@/lib/types";

interface FormsPanelProps {
  documentText: string;
  onCitationClick?: (page: number) => void;
}

export function FormsPanel({ documentText, onCitationClick }: FormsPanelProps) {
  const [forms, setForms] = useState<ExtractedForm[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState(false);
  const prevDocRef = useRef(documentText);

  // Reset when document changes
  useEffect(() => {
    if (documentText !== prevDocRef.current) {
      prevDocRef.current = documentText;
      setForms([]);
      setExtracted(false);
      setError(null);
    }
  }, [documentText]);

  const handleExtract = async () => {
    if (!documentText) return;
    setIsExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentContext: documentText }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      const formsWithIds: ExtractedForm[] = (data.forms || []).map(
        (f: Omit<ExtractedForm, "id">, i: number) => ({
          ...f,
          id: `form-${i}`,
        })
      );
      setForms(formsWithIds);
      setExtracted(true);
    } catch (e) {
      console.error("Form extraction failed:", e);
      setError("Failed to extract forms. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownloadAll = async () => {
    // Download each form sequentially
    for (const form of forms) {
      try {
        const editorEl = document.querySelector(
          `[data-form-id="${form.id}"] .tiptap`
        );
        const html = editorEl?.innerHTML || form.contentHtml;
        const res = await fetch("/api/export-docx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, filename: form.title, tags: form.tags }),
        });
        if (!res.ok) continue;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${form.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // skip failed downloads
      }
    }
  };

  // No document loaded
  if (!documentText) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No document loaded</p>
          <p className="text-xs mt-1">
            Select a PDF document first to extract forms
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isExtracting) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto mb-3 animate-spin text-indigo-500"
          />
          <p className="text-sm font-medium text-gray-700">
            Extracting forms & annexures...
          </p>
          <p className="text-xs text-gray-400 mt-1">
            AI is analyzing the document. This may take a moment.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button size="sm" onClick={handleExtract}>
            <RefreshCw size={14} className="mr-1" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Not yet extracted
  if (!extracted) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-xs">
          <FileText size={48} className="mx-auto mb-3 text-indigo-200" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            Forms & Annexures
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Extract all forms, annexures, schedules, and declarations from this
            document using AI.
          </p>
          <Button onClick={handleExtract} className="gap-1.5">
            <FileText size={14} />
            Extract Forms & Annexures
          </Button>
        </div>
      </div>
    );
  }

  // No forms found
  if (forms.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No forms found</p>
          <p className="text-xs mt-1">
            The AI could not identify any forms or annexures in this document.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={handleExtract}
          >
            <RefreshCw size={14} className="mr-1" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Forms list
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-xs text-gray-500">
          {forms.length} form{forms.length !== 1 ? "s" : ""} found
          {(() => {
            const allTags = new Set(forms.flatMap((f) => f.tags || []));
            return allTags.size > 0 ? (
              <span className="text-amber-600 ml-1">
                &middot; {allTags.size} requirement{allTags.size !== 1 ? "s" : ""} detected
              </span>
            ) : null;
          })()}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={handleExtract}
          >
            <RefreshCw size={12} />
            Re-extract
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleDownloadAll}
          >
            <Download size={12} />
            Download All
          </Button>
        </div>
      </div>

      {/* Forms */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {forms.map((form) => (
          <div key={form.id} data-form-id={form.id}>
            <FormEditor form={form} onCitationClick={onCitationClick} />
          </div>
        ))}
      </div>
    </div>
  );
}

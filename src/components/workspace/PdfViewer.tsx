"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  onTextExtracted?: (text: string) => void;
  targetPage?: { page: number; ts: number } | null;
  highlightText?: string | null;
}

export function PdfViewer({ url, onTextExtracted, targetPage, highlightText }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const onDocumentLoadSuccess = useCallback(
    async ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);

      // Extract text with page markers for AI context
      if (onTextExtracted) {
        try {
          const pdf = await pdfjs.getDocument(url).promise;
          const textParts: string[] = [];
          const pagesToExtract = Math.min(total, 50);
          for (let i = 1; i <= pagesToExtract; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ");
            textParts.push(`[Page ${i}]\n${pageText}`);
          }
          onTextExtracted(textParts.join("\n\n"));
        } catch (e) {
          console.error("Text extraction failed:", e);
        }
      }
    },
    [url, onTextExtracted]
  );

  // Scroll to target page when citation is clicked
  useEffect(() => {
    if (targetPage && targetPage.page >= 1 && targetPage.page <= numPages) {
      const pageEl = pageRefs.current.get(targetPage.page);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [targetPage, numPages]);

  // Track current page based on scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerMid = containerRect.top + containerRect.height / 3;

      let closestPage = 1;
      let closestDist = Infinity;

      pageRefs.current.forEach((el, pageNum) => {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top - containerMid);
        if (dist < closestDist) {
          closestDist = dist;
          closestPage = pageNum;
        }
      });

      setCurrentPage(closestPage);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [numPages]);

  // Highlight matching text in the text layer
  useEffect(() => {
    if (!highlightText) return;

    const timeout = setTimeout(() => {
      const textLayers = containerRef.current?.querySelectorAll(".react-pdf__Page__textContent");
      if (!textLayers) return;

      textLayers.forEach((textLayer) => {
        const spans = textLayer.querySelectorAll("span");
        spans.forEach((span) => {
          (span as HTMLElement).style.backgroundColor = "";
        });

        const searchLower = highlightText.toLowerCase();
        spans.forEach((span) => {
          if (span.textContent?.toLowerCase().includes(searchLower)) {
            (span as HTMLElement).style.backgroundColor = "rgba(255, 213, 79, 0.4)";
          }
        });
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [numPages, highlightText]);

  const setPageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-sm text-gray-600">
          Page {currentPage} of {numPages}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
          >
            <ZoomOut size={16} />
          </Button>
          <span className="text-sm text-gray-600 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.min(2.0, s + 0.1))}
          >
            <ZoomIn size={16} />
          </Button>
        </div>
      </div>

      {/* PDF content — all pages rendered in scrollable container */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          }
          error={
            <div className="flex items-center justify-center h-64 text-red-500">
              Failed to load PDF
            </div>
          }
        >
          <div className="flex flex-col items-center gap-2 py-4">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div key={pageNum} ref={(el) => setPageRef(pageNum, el)}>
                <Page
                  pageNumber={pageNum}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}

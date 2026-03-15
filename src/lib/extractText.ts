/**
 * Client-side text extraction from PDF and DOCX blobs.
 * - PDF: uses pdfjs-dist (same version as react-pdf)
 * - DOCX: uses mammoth for rich text extraction
 * - Scanned PDFs: renders pages to images for vision-based extraction
 */

const MAX_CHARS = 80_000;
const MAX_PAGES = 60;
const MAX_VISION_PAGES = 8;

export async function extractTextFromBlob(
  blob: Blob,
  fileType: string
): Promise<string> {
  const ft = fileType.toLowerCase();

  if (ft === "pdf") {
    return extractPdf(blob);
  }

  if (ft === "docx" || ft === "doc") {
    return extractDocx(blob);
  }

  // Images, spreadsheets, etc. — can't extract text client-side
  return "";
}

/**
 * For scanned PDFs where text extraction returns empty/minimal text,
 * render pages to images and return as base64 data URLs for vision AI.
 */
export { renderPdfPagesToImages } from "./renderPdfPages";

async function extractPdf(blob: Blob): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];
    const pagesToExtract = Math.min(pdf.numPages, MAX_PAGES);

    for (let i = 1; i <= pagesToExtract; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      textParts.push(`[Page ${i}]\n${pageText}`);
    }

    const fullText = textParts.join("\n\n");
    return fullText.slice(0, MAX_CHARS);
  } catch (err) {
    console.error("[extractText] PDF extraction failed:", err);
    return "";
  }
}

async function extractDocx(blob: Blob): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const arrayBuffer = await blob.arrayBuffer();

    // Extract raw text (no HTML formatting — cleaner for AI processing)
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value || "";

    if (!text.trim()) {
      console.warn("[extractText] DOCX extraction returned empty text");
      return "";
    }

    return text.slice(0, MAX_CHARS);
  } catch (err) {
    console.error("[extractText] DOCX extraction failed:", err);
    return "";
  }
}

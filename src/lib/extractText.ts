/**
 * Client-side text extraction from PDF blobs using pdfjs-dist.
 * Reuses the same pdfjs version bundled with react-pdf.
 */

const MAX_CHARS = 80_000;
const MAX_PAGES = 60;

export async function extractTextFromBlob(
  blob: Blob,
  fileType: string
): Promise<string> {
  // Only extract text from PDFs for now
  if (fileType !== "pdf") return "";

  try {
    // Dynamic import to avoid SSR issues
    const pdfjsLib = await import("pdfjs-dist");

    // Set worker source (same as PdfViewer)
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
    // Truncate to stay within Gemini token limits
    return fullText.slice(0, MAX_CHARS);
  } catch (err) {
    console.error("[extractText] PDF extraction failed:", err);
    return "";
  }
}

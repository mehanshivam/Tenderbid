/**
 * Renders PDF pages to images for vision-based AI extraction.
 * Separated from extractText.ts to avoid Turbopack SSR issues
 * with document.createElement("canvas").
 */

const MAX_VISION_PAGES = 8;

export async function renderPdfPagesToImages(
  blob: Blob,
  maxPages = MAX_VISION_PAGES
): Promise<string[]> {
  if (typeof window === "undefined") return [];
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pagesToRender = Math.min(pdf.numPages, maxPages);
    const images: string[] = [];

    for (let i = 1; i <= pagesToRender; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render({ canvasContext: ctx, viewport } as any) as any).promise;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      images.push(dataUrl);

      canvas.width = 0;
      canvas.height = 0;
    }

    return images;
  } catch (err) {
    console.error("[renderPdfPages] PDF page rendering failed:", err);
    return [];
  }
}

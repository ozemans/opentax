/**
 * OCR text extraction fallback using Tesseract.js.
 *
 * When pdfjs-dist returns 0 text items from a PDF that has pages,
 * the PDF likely contains scanned images. This module renders each
 * page to a canvas via pdfjs-dist, runs Tesseract.js OCR, and
 * returns ExtractedTextItem[] compatible with our parsers.
 *
 * Runs entirely client-side — language data is served from /tessdata.
 */

import type { ExtractedTextItem } from '@/utils/pdf-extract';

// Render scale: 2 = 144 DPI (good balance of OCR accuracy vs speed)
const RENDER_SCALE = 2;

/**
 * Extract text from an image-based PDF via OCR.
 *
 * Renders each page to canvas, runs Tesseract OCR, converts pixel
 * coordinates to PDF point space, and returns sorted items.
 */
export async function extractTextViaOcr(
  fileBytes: ArrayBuffer,
  onProgress?: (page: number, totalPages: number) => void,
): Promise<ExtractedTextItem[]> {
  // Lazy-load dependencies
  const [pdfjsLib, { createWorker }] = await Promise.all([
    import('pdfjs-dist'),
    import('tesseract.js'),
  ]);

  // Load the PDF
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fileBytes) }).promise;
  const numPages = pdf.numPages;

  // Create Tesseract worker with local language data (no CDN requests)
  const worker = await createWorker('eng', undefined, {
    langPath: '/tessdata',
  });

  const items: ExtractedTextItem[] = [];

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      onProgress?.(pageNum, numPages);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });

      // Create an offscreen canvas and render the PDF page
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      // Run OCR with word-level bounding boxes
      const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });

      // Extract words and convert coordinates to PDF point space
      if (data.blocks) {
        for (const block of data.blocks) {
          for (const para of block.paragraphs) {
            for (const line of para.lines) {
              for (const word of line.words) {
                const text = word.text.trim();
                if (text === '') continue;

                // Convert pixel coords to PDF points (flip y: PDF is bottom-up)
                const x = word.bbox.x0 / RENDER_SCALE;
                const y = (canvas.height - word.bbox.y0) / RENDER_SCALE;

                items.push({ text, x, y, page: pageNum });
              }
            }
          }
        }
      }
    }
  } finally {
    await worker.terminate();
  }

  // Sort: page ASC, y DESC (top-to-bottom), x ASC (left-to-right)
  items.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 0.5) return b.y - a.y;
    return a.x - b.x;
  });

  return items;
}

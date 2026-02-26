/**
 * Low-level PDF text extraction using pdfjs-dist.
 *
 * Extracts text items with their spatial positions from a PDF file,
 * enabling downstream parsers to reconstruct document structure.
 * Runs entirely client-side — no network requests.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedTextItem {
  text: string;
  x: number;       // horizontal position
  y: number;       // vertical position (page-relative)
  page: number;
}

export interface PdfExtractionResult {
  items: ExtractedTextItem[];
  numPages: number;
  needsPassword: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract text items with spatial positions from a PDF.
 *
 * Text items are sorted by page, then by y (descending — top to bottom),
 * then by x (left to right).
 *
 * If the PDF is password-protected and no password is provided, returns
 * `{ items: [], numPages: 0, needsPassword: true }`.
 */
export async function extractPdfText(
  fileBytes: ArrayBuffer,
  password?: string,
): Promise<PdfExtractionResult> {
  let pdf: pdfjsLib.PDFDocumentProxy;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(fileBytes),
      password,
    });
    pdf = await loadingTask.promise;
  } catch (err: unknown) {
    // Check for password-required error
    if (
      err instanceof Error &&
      (err.name === 'PasswordException' ||
        err.message.includes('password') ||
        err.message.includes('Password'))
    ) {
      return { items: [], numPages: 0, needsPassword: true };
    }
    throw err;
  }

  const items: ExtractedTextItem[] = [];
  const numPages = pdf.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      // Skip non-text items (marked content, etc.)
      if (!('str' in item) || !('transform' in item)) continue;

      const textItem = item as { str: string; transform: number[] };
      const text = textItem.str.trim();
      if (text === '') continue;

      // transform is a 6-element matrix: [scaleX, skewX, skewY, scaleY, x, y]
      const x = textItem.transform[4];
      const y = textItem.transform[5];

      items.push({ text, x, y, page: pageNum });
    }
  }

  // Sort: by page ASC, then y DESC (top-to-bottom), then x ASC (left-to-right)
  items.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 0.5) return b.y - a.y; // y DESC (PDF y is bottom-up)
    return a.x - b.x;
  });

  return { items, numPages, needsPassword: false };
}

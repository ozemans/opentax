// PDF Merge
// Merges multiple PDF documents into a single PDF using pdf-lib's copyPages.

import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDFs into a single document.
 *
 * @param pdfs - Array of PDF byte arrays to merge (in order)
 * @returns Merged PDF as Uint8Array
 * @throws Error if the array is empty
 */
export async function mergePdfs(pdfs: Uint8Array[]): Promise<Uint8Array> {
  if (pdfs.length === 0) {
    throw new Error('Cannot merge an empty array of PDFs');
  }

  // Single PDF: return as-is (no merge overhead)
  if (pdfs.length === 1) {
    return pdfs[0];
  }

  // Create a new document and copy all pages from each input PDF
  const mergedDoc = await PDFDocument.create();

  for (const pdfBytes of pdfs) {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageIndices = srcDoc.getPageIndices();
    const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);

    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }

  return mergedDoc.save();
}

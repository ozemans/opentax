import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs } from '../../src/pdf/merge';
import { createSyntheticTemplate, getPageCount } from './helpers';

describe('mergePdfs', () => {
  it('should merge two PDFs and have correct page count', async () => {
    const pdf1 = await createSyntheticTemplate(['field1']);
    const pdf2 = await createSyntheticTemplate(['field2']);

    const merged = await mergePdfs([pdf1, pdf2]);
    const pageCount = await getPageCount(merged);

    expect(pageCount).toBe(2);
  });

  it('should pass through a single PDF without merging', async () => {
    const pdf1 = await createSyntheticTemplate(['field1']);

    const result = await mergePdfs([pdf1]);

    // Single PDF is returned as-is (same reference)
    expect(result).toBe(pdf1);
  });

  it('should throw when given an empty array', async () => {
    await expect(mergePdfs([])).rejects.toThrow('Cannot merge an empty array of PDFs');
  });

  it('should merge three PDFs correctly', async () => {
    const pdf1 = await createSyntheticTemplate(['a']);
    const pdf2 = await createSyntheticTemplate(['b']);
    const pdf3 = await createSyntheticTemplate(['c']);

    const merged = await mergePdfs([pdf1, pdf2, pdf3]);
    const pageCount = await getPageCount(merged);

    expect(pageCount).toBe(3);
  });

  it('should handle PDFs with multiple pages', async () => {
    // Create a multi-page PDF
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    doc.addPage([612, 792]);
    const multiPagePdf = await doc.save();

    const singlePagePdf = await createSyntheticTemplate(['field']);

    const merged = await mergePdfs([multiPagePdf, singlePagePdf]);
    const pageCount = await getPageCount(merged);

    expect(pageCount).toBe(3); // 2 + 1
  });

  it('should produce a valid PDF', async () => {
    const pdf1 = await createSyntheticTemplate(['field1']);
    const pdf2 = await createSyntheticTemplate(['field2']);

    const merged = await mergePdfs([pdf1, pdf2]);

    // Verify the merged bytes can be loaded as a valid PDF
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(2);
  });
});

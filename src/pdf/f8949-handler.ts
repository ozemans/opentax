// Form 8949 Multi-Page Handler
// Handles the special case where Form 8949 can have many transactions
// that span multiple pages (14 rows per page).

import { PDFDocument, PDFTextField } from 'pdf-lib';
import type { TemplateLoader } from './types';
import { PdfTemplateError } from './types';
import { getFieldMap } from './field-maps/index';

/** Maximum transaction rows per Form 8949 page (actual IRS form has 11 rows per part). */
const ROWS_PER_PAGE = 11;

/**
 * Split an array into chunks of the given size.
 */
function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Fill Form 8949 across multiple pages.
 *
 * Takes the f8949 array from TaxResult.forms (array of transaction records),
 * chunks them into groups of 14 (rows per page), and fills one template copy
 * per chunk.
 *
 * @param transactions - Array of transaction records from TaxResult.forms.f8949
 * @param templateLoader - Function to load PDF template bytes
 * @returns Array of filled PDF bytes (one per page), empty if no transactions
 */
export async function fillForm8949(
  transactions: Record<string, string | number>[],
  templateLoader: TemplateLoader,
): Promise<Uint8Array[]> {
  if (transactions.length === 0) {
    return [];
  }

  // Load the template once
  let templateBytes: Uint8Array;
  try {
    templateBytes = await templateLoader('f8949');
  } catch (err) {
    throw new PdfTemplateError(
      `Failed to load Form 8949 template: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const fieldMap = getFieldMap('f8949');
  const chunks = chunk(transactions, ROWS_PER_PAGE);
  const pages: Uint8Array[] = [];

  for (const txChunk of chunks) {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Fill each row in this page's chunk
    txChunk.forEach((tx, rowIndex) => {
      const rowNum = rowIndex + 1;

      for (const [fieldKey, value] of Object.entries(tx)) {
        // Look up the row-specific field mapping
        const rowFieldKey = `row${rowNum}_${fieldKey}`;
        const mapping = fieldMap[rowFieldKey];
        if (!mapping) continue;

        try {
          const pdfField = form.getField(mapping.pdfFieldName);
          if (pdfField instanceof PDFTextField) {
            pdfField.setText(String(value));
          }
        } catch {
          // PDF field not found — expected with placeholder field names
        }
      }
    });

    // Compute page totals
    let pageProceeds = 0;
    let pageBasis = 0;
    let pageGainLoss = 0;

    for (const tx of txChunk) {
      pageProceeds += typeof tx['proceeds'] === 'number' ? tx['proceeds'] : 0;
      pageBasis += typeof tx['basis'] === 'number' ? tx['basis'] : 0;
      pageGainLoss += typeof tx['gainLoss'] === 'number' ? tx['gainLoss'] : 0;
    }

    // Try to set page total fields (these are optional in the template)
    const totalFields = [
      { name: 'f8949_totalProceeds', value: pageProceeds },
      { name: 'f8949_totalBasis', value: pageBasis },
      { name: 'f8949_totalGainLoss', value: pageGainLoss },
    ];
    for (const { name, value } of totalFields) {
      try {
        const field = form.getField(name);
        if (field instanceof PDFTextField) {
          field.setText(String(value));
        }
      } catch {
        // Optional field, skip if not present
      }
    }

    form.flatten();
    pages.push(await pdfDoc.save());
  }

  return pages;
}

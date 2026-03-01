// Form 8949 Multi-Page Handler
// Generates correct Part I (Short-Term) and Part II (Long-Term) pages.
// Each IRS category (A–F) gets its own set of pages; categories are never mixed on a page.
//
// Part I (categories A/B/C) uses Page 1 field names (f1_XX prefix).
// Part II (categories D/E/F) uses Page 2 field names (f2_XX prefix).
// Each page gets the appropriate category checkbox checked.

import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import type { AdjustedForm1099B, Form8949Category } from '../engine/types';
import type { TemplateLoader } from './types';
import { PdfTemplateError } from './types';
import {
  f8949PartIFieldMap,
  f8949PartIIFieldMap,
  PART_I_CHECKBOXES,
  PART_II_CHECKBOXES,
  ROWS_PER_PAGE_8949,
  PART_I_CATEGORIES,
} from './field-maps/f8949';
import type { FieldMap } from './field-maps/types';

/** Split an array into chunks of the given size. */
function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Fill one Form 8949 page for a chunk of transactions.
 *
 * @param txChunk   - Up to 11 transactions for this page
 * @param fieldMap  - Part I or Part II field map
 * @param checkboxFieldName - Optional checkbox field name to check (e.g. 'c1_1[0]')
 * @param templateBytes - The raw PDF template bytes
 */
async function fillOnePage(
  txChunk: AdjustedForm1099B[],
  fieldMap: FieldMap,
  checkboxFieldName: string | undefined,
  templateBytes: Uint8Array,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // Check the category checkbox (A/B/C or D/E/F)
  if (checkboxFieldName) {
    try {
      const cbField = form.getField(checkboxFieldName);
      if (cbField instanceof PDFCheckBox) {
        cbField.check();
      }
    } catch {
      // Checkbox field not found in template — silently skip
    }
  }

  // Fill transaction rows
  txChunk.forEach((tx, rowIndex) => {
    const rowNum = rowIndex + 1;

    const rowData: Record<string, string | number> = {
      description: tx.description,
      dateAcquired: tx.dateAcquired,
      dateSold: tx.dateSold,
      proceeds: toDollars(tx.proceeds),
      basis: toDollars(tx.costBasis),
      adjustmentCode: tx.adjustmentCode,
      adjustment: tx.washSaleDisallowed ? toDollars(tx.washSaleDisallowed) : '',
      gainLoss: toDollars(tx.effectiveGainLoss),
    };

    for (const [fieldKey, value] of Object.entries(rowData)) {
      const rowFieldKey = `row${rowNum}_${fieldKey}`;
      const mapping = fieldMap[rowFieldKey];
      if (!mapping) continue;

      try {
        const pdfField = form.getField(mapping.pdfFieldName);
        if (pdfField instanceof PDFTextField) {
          pdfField.setText(String(value));
        }
      } catch {
        // PDF field not found — silently skip
      }
    }
  });

  // Compute and fill page totals
  let pageProceeds = 0;
  let pageBasis = 0;
  let pageGainLoss = 0;

  for (const tx of txChunk) {
    pageProceeds += tx.proceeds;
    pageBasis += tx.costBasis;
    pageGainLoss += tx.effectiveGainLoss;
  }

  const totalFieldMappings = [
    { key: 'totalProceeds', value: toDollars(pageProceeds) },
    { key: 'totalBasis',    value: toDollars(pageBasis) },
    { key: 'totalGainLoss', value: toDollars(pageGainLoss) },
  ];

  for (const { key, value } of totalFieldMappings) {
    const mapping = fieldMap[key];
    if (!mapping) continue;
    try {
      const pdfField = form.getField(mapping.pdfFieldName);
      if (pdfField instanceof PDFTextField) {
        pdfField.setText(String(value));
      }
    } catch {
      // Optional field, skip if not present
    }
  }

  form.flatten();
  return pdfDoc.save();
}

/** Convert cents to dollars (as a number). */
function toDollars(cents: number): number {
  return cents / 100;
}

/**
 * Fill Form 8949 across multiple pages, properly split by category.
 *
 * IRS rule: each Form 8949 page checks exactly ONE of A/B/C (Part I) or D/E/F (Part II).
 * Transactions from different categories must go on separate pages.
 *
 * Part I pages (Short-Term categories A, B, C) come before Part II pages.
 *
 * @param categorized   - Transactions grouped by Form8949Category (from CapitalGainsResult)
 * @param templateLoader - Function to load PDF template bytes
 * @returns Array of filled PDF bytes; all Part I pages first, then all Part II pages
 */
export async function fillForm8949(
  categorized: Record<Form8949Category, AdjustedForm1099B[]>,
  templateLoader: TemplateLoader,
): Promise<Uint8Array[]> {
  // Check if there are any transactions at all
  const hasAny = Object.values(categorized).some(txs => txs.length > 0);
  if (!hasAny) {
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

  const partIPages: Uint8Array[] = [];
  const partIIPages: Uint8Array[] = [];

  // Process categories in order: Part I first (A, B, C), then Part II (D, E, F)
  const categoryOrder: Form8949Category[] = [
    '8949_A', '8949_B', '8949_C',  // Part I (Short-Term)
    '8949_D', '8949_E', '8949_F',  // Part II (Long-Term)
  ];

  for (const category of categoryOrder) {
    const transactions = categorized[category];
    if (!transactions || transactions.length === 0) continue;

    const isPartI = PART_I_CATEGORIES.has(category);
    const fieldMap = isPartI ? f8949PartIFieldMap : f8949PartIIFieldMap;
    const checkboxes = isPartI ? PART_I_CHECKBOXES : PART_II_CHECKBOXES;
    const checkboxFieldName = checkboxes[category];

    const chunks = chunk(transactions, ROWS_PER_PAGE_8949);

    for (const txChunk of chunks) {
      const pageBytes = await fillOnePage(txChunk, fieldMap, checkboxFieldName, templateBytes);
      if (isPartI) {
        partIPages.push(pageBytes);
      } else {
        partIIPages.push(pageBytes);
      }
    }
  }

  // All Part I pages first, then Part II pages (per IRS form ordering)
  return [...partIPages, ...partIIPages];
}

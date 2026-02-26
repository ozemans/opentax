// Field map for Form 8949 (Sales and Other Dispositions of Capital Assets) — 2025
// Maps engine field names from mapForm8949() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f8949.pdf template.
// Uses "topmostSubform[0].Page1[0]." for Part I (Short-Term)
// and "topmostSubform[0].Page2[0]." for Part II (Long-Term).
//
// Each page has 11 transaction rows (not 14).
// Each row has 8 fields:
//   (a) Description of property
//   (b) Date acquired
//   (c) Date sold or disposed of
//   (d) Proceeds (sales price)
//   (e) Cost or other basis
//   (f) Code(s) from instructions
//   (g) Amount of adjustment
//   (h) Gain or (loss)
//
// Row field naming pattern on Page 1:
//   Row1: f1_03 through f1_10 (8 fields per row)
//   Row2: f1_11 through f1_18
//   ...
//   Row11: f1_83 through f1_90
//   Totals: f1_91 (proceeds), f1_92 (basis), f1_93 (adjustment), f1_94 (gain/loss), f1_95
//
// Page 2 follows the same pattern with f2_ prefix.
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;

// Build row-specific field maps for Part I (short-term, Page 1)
// Row 1 starts at f1_03, each row has 8 fields
function buildRowFields(): FieldMap {
  const fields: FieldMap = {};
  const ROW_COUNT = 11;
  const FIELDS_PER_ROW = 8;
  const START_FIELD = 3; // f1_03 is the first row field

  const fieldNames = [
    'description', 'dateAcquired', 'dateSold', 'proceeds',
    'basis', 'category', 'adjustment', 'gainLoss',
  ];

  for (let row = 1; row <= ROW_COUNT; row++) {
    const rowStartField = START_FIELD + (row - 1) * FIELDS_PER_ROW;
    const tableRow = `Table_Line1_Part1[0].Row${row}[0]`;

    for (let col = 0; col < FIELDS_PER_ROW; col++) {
      const fieldNum = String(rowStartField + col).padStart(2, '0');
      const engineKey = `row${row}_${fieldNames[col]}`;
      fields[engineKey] = {
        pdfFieldName: p1(`${tableRow}.f1_${fieldNum}[0]`),
        type: 'text',
      };
    }
  }

  return fields;
}

// Base row fields (used by f8949-handler for per-row lookups)
// These are not directly used but provide the base field definitions
const baseRowFields: FieldMap = {
  description:  { pdfFieldName: 'f8949_description', type: 'text' },
  dateAcquired: { pdfFieldName: 'f8949_dateAcquired', type: 'text' },
  dateSold:     { pdfFieldName: 'f8949_dateSold', type: 'text' },
  proceeds:     { pdfFieldName: 'f8949_proceeds', type: 'text' },
  basis:        { pdfFieldName: 'f8949_basis', type: 'text' },
  gainLoss:     { pdfFieldName: 'f8949_gainLoss', type: 'text' },
  category:     { pdfFieldName: 'f8949_category', type: 'text' },
};

const rowFields = buildRowFields();

// Page totals
const totalFields: FieldMap = {
  totalProceeds: { pdfFieldName: p1('f1_91[0]'), type: 'text' },
  totalBasis:    { pdfFieldName: p1('f1_92[0]'), type: 'text' },
  totalGainLoss: { pdfFieldName: p1('f1_94[0]'), type: 'text' },
};

export const f8949FieldMap: FieldMap = {
  ...baseRowFields,
  ...rowFields,
  ...totalFields,
};

/**
 * Maximum transaction rows per Form 8949 page.
 * The actual IRS form has 11 rows per page (per part).
 */
export const ROWS_PER_PAGE_8949 = 11;

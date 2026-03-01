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
// Row field naming pattern on Page 1 (Part I, Short-Term):
//   Row1: f1_03 through f1_10 (8 fields per row)
//   Row2: f1_11 through f1_18
//   ...
//   Row11: f1_83 through f1_90
//   Totals: f1_91 (proceeds), f1_92 (basis), f1_93 (adjustment), f1_94 (gain/loss)
//   Category checkboxes: f1_01 (A), f1_02 (B); C is remainder
//
// Page 2 follows the same pattern with f2_ prefix (Part II, Long-Term).
//   Category checkboxes: f2_01 (D), f2_02 (E); F is remainder
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;
const p2 = (name: string) => `topmostSubform[0].Page2[0].${name}`;

// Build row-specific field maps for Part I (short-term, Page 1)
// Row 1 starts at f1_03, each row has 8 fields
function buildPartIRowFields(): FieldMap {
  const fields: FieldMap = {};
  const ROW_COUNT = 11;
  const FIELDS_PER_ROW = 8;
  const START_FIELD = 3; // f1_03 is the first row field

  const fieldNames = [
    'description', 'dateAcquired', 'dateSold', 'proceeds',
    'basis', 'adjustmentCode', 'adjustment', 'gainLoss',
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

// Build row-specific field maps for Part II (long-term, Page 2)
// Same pattern as Part I but with Page2 prefix and f2_ field names
function buildPartIIRowFields(): FieldMap {
  const fields: FieldMap = {};
  const ROW_COUNT = 11;
  const FIELDS_PER_ROW = 8;
  const START_FIELD = 3; // f2_03 is the first row field

  const fieldNames = [
    'description', 'dateAcquired', 'dateSold', 'proceeds',
    'basis', 'adjustmentCode', 'adjustment', 'gainLoss',
  ];

  for (let row = 1; row <= ROW_COUNT; row++) {
    const rowStartField = START_FIELD + (row - 1) * FIELDS_PER_ROW;
    const tableRow = `Table_Line1_Part2[0].Row${row}[0]`;

    for (let col = 0; col < FIELDS_PER_ROW; col++) {
      const fieldNum = String(rowStartField + col).padStart(2, '0');
      const engineKey = `row${row}_${fieldNames[col]}`;
      fields[engineKey] = {
        pdfFieldName: p2(`${tableRow}.f2_${fieldNum}[0]`),
        type: 'text',
      };
    }
  }

  return fields;
}

// Part I row fields
const partIRowFields = buildPartIRowFields();
// Part II row fields
const partIIRowFields = buildPartIIRowFields();

// Part I totals (Page 1)
const partITotalFields: FieldMap = {
  totalProceeds: { pdfFieldName: p1('f1_91[0]'), type: 'text' },
  totalBasis:    { pdfFieldName: p1('f1_92[0]'), type: 'text' },
  totalGainLoss: { pdfFieldName: p1('f1_94[0]'), type: 'text' },
};

// Part II totals (Page 2)
const partIITotalFields: FieldMap = {
  totalProceeds: { pdfFieldName: p2('f2_91[0]'), type: 'text' },
  totalBasis:    { pdfFieldName: p2('f2_92[0]'), type: 'text' },
  totalGainLoss: { pdfFieldName: p2('f2_94[0]'), type: 'text' },
};

// Part I category checkboxes (Short-Term: A, B, C)
// A = Box 1g reported; B = not reported; C = no 1099-B
export const PART_I_CHECKBOXES: Record<string, string> = {
  '8949_A': p1('c1_1[0]'),  // checkbox A
  '8949_B': p1('c1_2[0]'),  // checkbox B
  '8949_C': p1('c1_3[0]'),  // checkbox C
};

// Part II category checkboxes (Long-Term: D, E, F)
export const PART_II_CHECKBOXES: Record<string, string> = {
  '8949_D': p2('c2_1[0]'),  // checkbox D
  '8949_E': p2('c2_2[0]'),  // checkbox E
  '8949_F': p2('c2_3[0]'),  // checkbox F
};

// Part I field map (Short-Term, Page 1)
export const f8949PartIFieldMap: FieldMap = {
  ...partIRowFields,
  ...partITotalFields,
};

// Part II field map (Long-Term, Page 2)
export const f8949PartIIFieldMap: FieldMap = {
  ...partIIRowFields,
  ...partIITotalFields,
};

// Legacy combined field map (backward compat with getFieldMap('f8949'))
export const f8949FieldMap: FieldMap = {
  ...partIRowFields,
  ...partITotalFields,
};

/**
 * Maximum transaction rows per Form 8949 page.
 * The actual IRS form has 11 rows per page (per part).
 */
export const ROWS_PER_PAGE_8949 = 11;

/** Short-term categories (Part I) */
export const PART_I_CATEGORIES = new Set(['8949_A', '8949_B', '8949_C']);

/** Long-term categories (Part II) */
export const PART_II_CATEGORIES = new Set(['8949_D', '8949_E', '8949_F']);

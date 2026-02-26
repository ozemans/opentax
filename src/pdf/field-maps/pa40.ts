// Field map for PA-40 (Pennsylvania Personal Income Tax Return) — 2025
// Maps engine field names from the PA state module's formData to real AcroForm field names.
//
// AcroForm field names extracted from the 2025 PA-40 fill-in template.
// Pennsylvania uses descriptive field names like "9. Total PA Taxable Income".
//
// The PA engine (pennsylvania.ts) puts these keys in formData:
//   taxableIncome, taxRate, taxBeforeCredits
//
// PA-40 line mapping:
//   Line 9  = Total PA Taxable Income
//   Line 11 = Adjusted PA Taxable Income
//   Line 12 = PA Tax Liability (Line 11 × 3.07%)
//
// NOTE: taxRate is a percentage value, not cents. We skip it in the field map
// since it's not directly written to a PDF field (it's the fixed 3.07% rate).

import type { FieldMap } from './types';
import { centsToDollars } from './types';

export const pa40FieldMap: FieldMap = {
  // ── Taxable Income → PA-40 Line 11 (Adjusted PA Taxable Income) ──
  taxableIncome: {
    pdfFieldName: '11. Adjusted PA Taxable Income',
    type: 'text',
    transform: centsToDollars,
  },

  // ── PA Tax Liability → PA-40 Line 12 ──
  taxBeforeCredits: {
    pdfFieldName: '12. PA Tax Liability. Multiply Line 11 by 3.07%',
    type: 'text',
    transform: centsToDollars,
  },
};

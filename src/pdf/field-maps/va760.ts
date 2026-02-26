// Field map for VA-760 (Virginia Resident Income Tax Return) — 2025
// Maps engine field names from the VA state module's formData to real AcroForm field names.
//
// AcroForm field names extracted from the 2025 VA-760 fill-in template.
// Virginia uses human-readable field names like "1. Federal Adjusted Gross Income".
//
// The VA engine (virginia.ts) puts these keys in formData:
//   federalAGI, subtractions, standardDeduction, exemptions,
//   taxableIncome, taxBeforeCredits, stateEITC
//
// VA-760 line mapping:
//   Line 1  = Federal Adjusted Gross Income
//   Line 7  = Subtractions (from Schedule ADJ)
//   Line 11 = Standard Deduction
//   Line 12 = Total Exemptions (Section A + Section B)
//   Line 15 = Virginia Taxable Income
//   Line 16 = Amount of tax
//   Line 23 = Tax Credit for Low Income or Earned Income

import type { FieldMap } from './types';
import { centsToDollars } from './types';

export const va760FieldMap: FieldMap = {
  // ── Federal AGI → VA-760 Line 1 ──
  federalAGI: {
    pdfFieldName: '1. Federal Adjusted Gross Income',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Subtractions → VA-760 Line 7 ──
  subtractions: {
    pdfFieldName: '7. Subtractions',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Standard Deduction → VA-760 Line 11 ──
  standardDeduction: {
    pdfFieldName: '11. Standard Deduction',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Total Exemptions → VA-760 Line 12 ──
  exemptions: {
    pdfFieldName: '12. Total Exemptions Section A plus Section B above',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Virginia Taxable Income → VA-760 Line 15 ──
  taxableIncome: {
    pdfFieldName: '15. Virginia Taxable income',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Amount of Tax → VA-760 Line 16 ──
  taxBeforeCredits: {
    pdfFieldName: '16. Amount of tax',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Earned Income Credit → VA-760 Line 23 ──
  stateEITC: {
    pdfFieldName: '23. Tax Credit for Low Income or Earned Income',
    type: 'text',
    transform: centsToDollars,
  },
};

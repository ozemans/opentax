// Field map for IL-1040 (Illinois Individual Income Tax Return) — 2025
// Maps engine field names from the IL state module's formData to real AcroForm field names.
//
// AcroForm field names extracted from the 2025 IL-1040 fill-in template.
// Illinois uses descriptive field names like "Federally adjusted income".
//
// The IL engine (illinois.ts) puts these keys in formData:
//   federalAGI, subtractions, exemptions, taxableIncome,
//   taxRate, taxBeforeCredits, stateEITC
//
// IL-1040 line mapping (Step 3-5):
//   Line 1  = Federally adjusted gross income
//   Line 8  = Total of your subtractions
//   Line 10 = Exemption allowance
//   Line 9  = Illinois base income (Line 1 - Line 8)
//   Line 11 = Illinois net income
//   Line 14 = Income tax (taxable income × tax rate)
//   Line 23 = Earned Income Tax Credit from Schedule IL-E/EIC

import type { FieldMap } from './types';
import { centsToDollars } from './types';

export const il1040FieldMap: FieldMap = {
  // ── Federal AGI → IL-1040 Line 1 ──
  federalAGI: {
    pdfFieldName: 'Federally adjusted income',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Subtractions → IL-1040 Line 8 ──
  subtractions: {
    pdfFieldName: 'Total of your subtractions',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Exemption Allowance → IL-1040 Line 10 ──
  exemptions: {
    pdfFieldName: 'Exemption allowance',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Taxable Income → IL-1040 Line 9 (Illinois base income) ──
  taxableIncome: {
    pdfFieldName: 'Illinois base income',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Income Tax → IL-1040 Line 14 ──
  taxBeforeCredits: {
    pdfFieldName: 'Income tax',
    type: 'text',
    transform: centsToDollars,
  },

  // ── State EITC → IL-1040 Line 23 ──
  stateEITC: {
    pdfFieldName: 'Earned Income Tax Credit from Schedule IL-E/EIC',
    type: 'text',
    transform: centsToDollars,
  },
};

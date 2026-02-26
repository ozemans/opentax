// Field map for Form 8960 (Net Investment Income Tax) — 2025
// Maps engine field names from mapForm8960() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f8960.pdf template.
// Uses "topmostSubform[0].Page1[0]." prefix (single page form, 38 fields).
//
// Part I: Net Investment Income (lines 1–8)
//   Line 1: Taxable interest
//   Line 2: Annuities
//   Line 3: Rental, royalty, S corps, partnerships
//   Line 4a: Net gain/loss from disposition (capital gains)
//   Line 4b: Net gain/loss from disposition (other)
//   Line 5a: Other modifications
//   Line 5b: Other modifications
//   Line 6: Adjustments to net gain/loss
//   Line 7: Other modifications
//   Line 8: Total investment income
//
// Part II: Modified Adjusted Gross Income (lines 9–11)
//   Line 9: MAGI
//   Line 10: Threshold
//   Line 11: Subtract line 10 from 9
//
// Part III: Tax Computation (lines 12–17)
//   Line 12: Smaller of line 8 or 11
//   Line 13: Multiply by 3.8% = NIIT
//
// Fields:
//   f1_1 = Name, f1_2 = SSN
//   c1_1, c1_2, c1_3 = Part I checkboxes (individual, estate, trust)
//   f1_3 = Line 1 (taxable interest)
//   f1_4 = Line 2 (annuities, nonqualified)
//   f1_5 = Line 3 (rental, royalty, etc.)
//   f1_6 = Line 4a (net gain from capital assets)
//   f1_7 = Line 4b (net gain from other)
//   f1_8 = Line 5a (adjustments to gain/loss: capital)
//   f1_9 = Line 5b (adjustments to gain/loss: other)
//   f1_10 = Line 6 (other modifications to investment income)
//   f1_11 = Line 7 (total of modifications)
//   f1_12 = Line 8 (net investment income)
//   f1_13-f1_16 = Part II and Part III lines
//   ...continuing through to f1_35
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;

export const f8960FieldMap: FieldMap = {
  // Part I: Net Investment Income
  interestIncome:       { pdfFieldName: p1('f1_3[0]'),  type: 'text' },  // Line 1 (taxable interest)
  dividendIncome:       { pdfFieldName: p1('f1_4[0]'),  type: 'text' },  // Line 2 (annuities/dividends)
  capitalGainsIncome:   { pdfFieldName: p1('f1_6[0]'),  type: 'text' },  // Line 4a (net capital gains)
  totalInvestmentIncome: { pdfFieldName: p1('f1_12[0]'), type: 'text' }, // Line 8 (total NII)

  // Part II: MAGI
  magi:                 { pdfFieldName: p1('f1_13[0]'), type: 'text' },  // Line 9 (MAGI)

  // Part III: Tax Computation
  // Line 12 = smaller of line 8 or 11
  // Line 13 = line 12 * 3.8%
  niitAmount:           { pdfFieldName: p1('f1_17[0]'), type: 'text' },  // Line 17 (NIIT amount)
};

// Field map for Form 8959 (Additional Medicare Tax) — 2025
// Maps engine field names from mapForm8959() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f8959.pdf template.
// Uses "topmostSubform[0].Page1[0]." prefix (single page form, 26 fields).
//
// Part I: Additional Medicare Tax on Medicare Wages (lines 1–7)
// Part II: Additional Medicare Tax on Self-Employment Income (lines 8–13)
// Part III: Additional Medicare Tax on Railroad Tier 1 (lines 14–17)
// Part IV: Total Additional Medicare Tax (line 18)
// Part V: Withholding Reconciliation (lines 19–24)
//
// Field layout:
//   f1_1 = Name, f1_2 = SSN
//   f1_3 = Line 1 (Medicare wages from W-2 Box 5)
//   f1_4 = Line 2 (unreported Medicare wages from Form 8919)
//   f1_5 = Line 3 (add lines 1 and 2)
//   f1_6 = Line 4 (threshold amount)
//   f1_7 = Line 5 (subtract line 4 from 3)
//   f1_8 = Line 6 (multiply line 5 by 0.9%)
//   f1_9 = Line 7 (Additional Medicare Tax on Medicare wages)
//   f1_10 = Line 8 (self-employment income)
//   f1_11 = Line 9 (threshold minus W-2 wages)
//   f1_12 = Line 10 (subtract line 9 from 8)
//   f1_13 = Line 11 (multiply line 10 by 0.9%)
//   f1_14-f1_18 = Lines 12-17 (Railroad tier 1, combined, totals)
//   f1_19 = Line 18 (total Additional Medicare Tax)
//   f1_20 = Line 19 (Medicare tax withheld from W-2 Box 6)
//   f1_21 = Line 20 (regular Medicare tax amount)
//   f1_22 = Line 21 (subtract line 20 from 19)
//   f1_23-f1_26 = Lines 22-24
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;

export const f8959FieldMap: FieldMap = {
  // Part I: Medicare Wages
  medicareWages:                { pdfFieldName: p1('f1_3[0]'),  type: 'text' },  // Line 1
  additionalMedicareTax:        { pdfFieldName: p1('f1_8[0]'),  type: 'text' },  // Line 6 (0.9% tax)

  // Part II: Self-Employment Income
  selfEmploymentMedicareWages:  { pdfFieldName: p1('f1_10[0]'), type: 'text' },  // Line 8

  // Combined
  combinedMedicareWages:        { pdfFieldName: p1('f1_5[0]'),  type: 'text' },  // Line 3

  // Part V: Withholding
  w2MedicareWithheld:           { pdfFieldName: p1('f1_20[0]'), type: 'text' },  // Line 19
};

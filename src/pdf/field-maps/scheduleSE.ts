// Field map for Schedule SE (Self-Employment Tax) — 2025
// Maps engine field names from mapScheduleSE() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040sse.pdf template.
// Uses "topmostSubform[0].Page1[0]." prefix.
//
// Section A — Short Schedule SE (most taxpayers use this):
//   Line 1a: Net farm profit (loss)
//   Line 1b: Net nonfarm profit (loss) from Schedule C
//   Line 2: Combine lines 1a and 1b
//   Line 3: Multiply line 2 by 92.35%
//   Line 4a: Social security tax
//   Line 4b: Medicare tax
//   Line 4c: Add lines 4a and 4b
//   Line 5: Deduction for one-half of SE tax
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;

export const scheduleSEFieldMap: FieldMap = {
  // f1_1 = Name, f1_2 = SSN
  // c1_1 = checkbox (skip lines 1a and 1b if only church employee income)

  // f1_3 = Line 1a (net farm profit)
  // f1_4 = Line 1b (net nonfarm profit/loss from Schedule C)
  // f1_5 = Line 2 (combine lines 1a and 1b)
  // f1_6 = Line 3 (multiply line 2 by 92.35%)
  netEarnings: { pdfFieldName: p1('f1_6[0]'), type: 'text' },  // Line 3 (SE taxable income)

  // f1_7 = Line 4a (if line 3 is more than zero, multiply by 12.4%)
  // This maps to the social security portion
  // But the actual form has a more complex structure:
  // Line 4a = multiply line 3 by 12.4% (but limited by wage base)
  // The actual field layout after line 3:
  // f1_7 = Line 4a note / reference to maximum
  // f1_8 = Line 4a (social security tax amount)
  socialSecurityTax: { pdfFieldName: p1('f1_8[0]'), type: 'text' },  // Line 4a SS tax

  // f1_9 = Line 4b (Medicare tax = line 3 * 2.9%)
  medicareTax: { pdfFieldName: p1('f1_9[0]'), type: 'text' },  // Line 4b Medicare tax

  // f1_10 = Line 5a (add lines 4a and 4b) — in Line5a_ReadOrder
  // f1_11 = Line 5b
  // f1_12 = Line 6 (total SE tax)
  totalSETax: { pdfFieldName: p1('f1_12[0]'), type: 'text' },  // Line 6 total SE tax

  // f1_13 = Line 7 (deductible part = line 6 * 50%)
  deductibleHalf: { pdfFieldName: p1('f1_13[0]'), type: 'text' },  // Line 7 deductible half
};

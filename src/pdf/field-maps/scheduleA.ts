// Field map for Schedule A (Itemized Deductions) — 2025
// Maps engine field names from the scheduleA mapping to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040sa.pdf template.
// Note: Schedule A uses "form1[0].Page1[0]." prefix.
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `form1[0].Page1[0].${name}`;

export const scheduleAFieldMap: FieldMap = {
  // f1_1 = Name, f1_2 = SSN
  // Medical and Dental Expenses
  // f1_3 = Line 1 (medical and dental expenses)
  line1:  { pdfFieldName: p1('f1_3[0]'), type: 'text' },   // Line 1 medical expenses
  // f1_4 = Line 2 (AGI amount) — in Line2_ReadOrder
  // f1_5 = Line 3 (multiply line 2 by 7.5%)
  // f1_6 = Line 4 (subtract line 3 from line 1)
  line4:  { pdfFieldName: p1('f1_6[0]'), type: 'text' },   // Line 4 medical after threshold

  // Taxes You Paid
  // f1_7 = Line 5a (state and local income taxes or sales tax)
  // f1_8 = Line 5b (state and local personal property taxes)
  // f1_9 = Line 5c (state and local real estate taxes)
  // f1_10 = Line 5d (add lines 5a through 5c)
  // f1_11 = Line 5e (enter the smaller of line 5d or $10,000)
  line5d: { pdfFieldName: p1('f1_11[0]'), type: 'text' },  // Line 5e (SALT capped at $10k)
  // f1_12 = Line 6 (other taxes)
  // f1_13 = Line 7 (add lines 5e and 6)

  // Interest You Paid
  // f1_14 = Line 8a (home mortgage interest from Form 1098)
  line8a: { pdfFieldName: p1('f1_14[0]'), type: 'text' },  // Line 8a mortgage interest
  // f1_15 = Line 8b (home mortgage interest not on 1098) — check c1_2
  // f1_16 = Line 8b amount (in Line8b_ReadOrder)
  // f1_17 = Line 8c (points not on 1098)
  // f1_18 = Line 9 (investment interest)
  // f1_19 = Line 10 (add lines 8a through 9)

  // Gifts to Charity
  // f1_20 = Line 11 (gifts by cash or check)
  line11: { pdfFieldName: p1('f1_20[0]'), type: 'text' },  // Line 11 charitable cash
  // f1_21 = Line 12 (other than cash or check)
  line12: { pdfFieldName: p1('f1_21[0]'), type: 'text' },  // Line 12 charitable non-cash
  // f1_22 = Line 13 (carryover from prior year)
  // f1_23 = Line 14 (add lines 11 through 13)

  // Other Itemized Deductions
  // f1_24 = Line 15
  // f1_25 = Line 16

  // Total Itemized Deductions
  // f1_26 = Line 17 (total itemized deductions)
  line17: { pdfFieldName: p1('f1_26[0]'), type: 'text' },  // Line 17 total itemized
  // f1_27-f1_30 = Lines 18-19 (more fields)
};

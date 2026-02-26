// Field map for Schedule 3 (Additional Credits and Payments) — 2025
// Maps engine field names from the schedule3 mapping to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040s3.pdf template.
// Uses "topmostSubform[0].Page1[0]." prefix.
// Part I: Nonrefundable Credits (lines 1–7)
// Part II: Other Payments and Refundable Credits (lines 9–15)
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;

export const schedule3FieldMap: FieldMap = {
  // f1_01 = Name, f1_02 = SSN
  // Part I: Nonrefundable Credits
  // f1_03 = Line 1 (foreign tax credit)
  // f1_04 = Line 2 (child and dependent care credit from Form 2441)
  line2: { pdfFieldName: p1('f1_04[0]'), type: 'text' },  // Line 2 child care credit
  // f1_05 = Line 3 (education credits from Form 8863)
  line3: { pdfFieldName: p1('f1_05[0]'), type: 'text' },  // Line 3 education credits
  // f1_06 = Line 4 (retirement savings credit / Saver's Credit)
  line4: { pdfFieldName: p1('f1_06[0]'), type: 'text' },  // Line 4 Saver's credit
  // f1_07 = Line 5a (residential energy credit)
  // f1_08 = Line 5b
  // f1_09 = Line 6a (other nonrefundable credits) — in Line6a_ReadOrder
  // f1_10 through f1_21 = Lines 6b through 6z (various sub-items)
  // f1_23 = Line 7 (total nonrefundable credits from Part I)
  // f1_24 = Line 8 (total, carried to Form 1040 line 20)

  // Part II: Other Payments and Refundable Credits
  // f1_25 = Line 9
  // f1_26 = Line 10
  // f1_27 = Line 11
  // f1_28 = Line 12
  // f1_29 = Line 13a
  // f1_30 = Line 13b (in Line13_ReadOrder)
  // f1_31 through f1_34 = Lines 13c through 13z
  // f1_35 = Line 14
  // f1_36 = Line 15 (total other payments and credits)
  // f1_37 = total
};

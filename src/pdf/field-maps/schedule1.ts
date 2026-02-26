// Field map for Schedule 1 (Additional Income and Adjustments to Income) — 2025
// Maps engine field names from mapSchedule1() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040s1.pdf template.
// Page 1: Part I — Additional Income (lines 1–10)
// Page 2: Part II — Adjustments to Income (lines 11–26)
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;
const p2 = (name: string) => `topmostSubform[0].Page2[0].${name}`;

export const schedule1FieldMap: FieldMap = {
  // ── Part I: Additional Income ──
  // f1_03 = Line 1 (taxable refunds)
  // f1_04 = Line 2a (alimony received)
  // f1_05 = Line 2b
  // f1_06 = Line 3 (business income from Schedule C)
  line3:  { pdfFieldName: p1('f1_06[0]'), type: 'text' },
  // f1_07 = Line 4 (other gains/losses)
  line4:  { pdfFieldName: p1('f1_07[0]'), type: 'text' },
  // f1_08 = Line 5 (rental real estate, etc.)
  // f1_09 = Line 6 (farm income)
  // f1_10 = Line 7 (unemployment compensation)
  line7:  { pdfFieldName: p1('f1_10[0]'), type: 'text' },
  // f1_11 through f1_36 = Lines 8a through 8z
  // f1_37 = Line 9 (total other income)
  // f1_38 = Line 10 (combine lines 1 through 9)
  line10: { pdfFieldName: p1('f1_38[0]'), type: 'text' },

  // ── Part II: Adjustments to Income (Page 2) ──
  // f2_01 = Line 11 (educator expenses)
  line11: { pdfFieldName: p2('f2_01[0]'), type: 'text' },
  // f2_02 = Line 12 (certain business expenses)
  // f2_03 = Line 13 (HSA deduction)
  // f2_04 = Line 14 (moving expenses for Armed Forces)
  // f2_05 = Line 15 (deductible part of self-employment tax)
  line15: { pdfFieldName: p2('f2_05[0]'), type: 'text' },
  // f2_06 = Line 16 (self-employed SEP, etc.)
  // f2_07 = Line 17 (self-employed health insurance)
  // f2_08 = Line 18 (penalty on early withdrawal)
  // f2_09 = Line 19a (IRA deduction — was line 20 in prior year?)

  // The exact field numbering for these adjustment lines:
  // Looking at the Schedule 1 form carefully:
  // Line 13 = HSA deduction
  line17: { pdfFieldName: p2('f2_03[0]'), type: 'text' },  // Line 13 HSA
  // Line 20 = IRA deduction
  line20: { pdfFieldName: p2('f2_09[0]'), type: 'text' },
  // Line 21 = Student loan interest deduction
  // f2_10 = Line 19b (in Line19b_CombField)
  // f2_11 = Line 20
  // f2_12 = Line 21
  line21: { pdfFieldName: p2('f2_12[0]'), type: 'text' },
  // f2_28 = Line 25 (total Part II adjustments)
  // f2_29 = Line 26 (total adjustments)
  // f2_30 = header repeat
};

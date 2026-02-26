// Field map for Schedule 2 (Additional Taxes) — 2025
// Maps engine field names from the schedule2 mapping to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040s2.pdf template.
// Note: Schedule 2 uses "form1[0]." prefix (not "topmostSubform[0].")
// Page 1: Part I — Tax (lines 1–4)
// Page 2: Part II — Other Taxes (lines 6–21)
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `form1[0].Page1[0].${name}`;
const p2 = (name: string) => `form1[0].Page2[0].${name}`;

export const schedule2FieldMap: FieldMap = {
  // ── Part I: Tax ──
  // f1_01 = Name, f1_02 = SSN
  // f1_03 = Line 1a (AMT from Form 6251) — in Line1a_ReadOrder
  line1: { pdfFieldName: p1('Line1a_ReadOrder[0].f1_03[0]'), type: 'text' },  // AMT
  // f1_04-f1_13 = Lines 1b through 3 (various tax items)
  // f1_13 = Line 3 (add lines 1 and 2)

  // ── Part II: Other Taxes (Page 2) ──
  // The page 2 fields follow the Part II structure:
  // f2_01 in Line17a_ReadOrder = Line 6 (self-employment tax from Schedule SE)
  // But actually the Part II structure is:
  // Line 6 = SE tax from Schedule SE
  // Line 11 = Additional Medicare Tax from Form 8959
  // Line 12 = Net investment income tax from Form 8960
  // Line 21 = Total additional taxes

  // Page 1 continuation — Part I continues with lines 1 through 4
  // f1_15 = Line 4 (Part I subtotal)
  // f1_16 = Line 5
  // f1_17 = Line 6 (SE tax from Schedule SE)
  line6:  { pdfFieldName: p1('f1_17[0]'), type: 'text' },  // Line 6 SE tax
  // f1_18 = Line 7
  // f1_19 = Line 8
  // f1_20 = Line 9
  // f1_21 = Line 10
  // f1_22 = Line 11 (Additional Medicare Tax)
  line11: { pdfFieldName: p1('f1_22[0]'), type: 'text' },  // Line 11 Additional Medicare
  // f1_23 = Line 12 (NIIT)
  line12: { pdfFieldName: p1('f1_23[0]'), type: 'text' },  // Line 12 NIIT
  // f1_24 = Line 13
  // f1_25 = Line 14
  // f1_26 = Line 15
  // f1_27 = Line 16

  // Page 2: Lines 17–21
  // f2_20 = Line 18 (total additional taxes)
  // f2_21 = Line 19
  // f2_22 = Line 20
  // f2_23 = Line 21 (total other taxes, combines Part I line 4 + Part II line 18/20)
  line21: { pdfFieldName: p2('f2_23[0]'), type: 'text' },  // Line 21 total
};

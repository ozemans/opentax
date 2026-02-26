// Field map for CA FTB 540 (California Resident Income Tax Return) — 2025
// Maps engine field names from the CA state module's formData to real AcroForm field names.
//
// AcroForm field names extracted from the 2025 FTB 540 fill-in template.
// Fields use a pattern like `540_form_XYYY` where X = page number and YYY = field index.
//
// The CA engine (california.ts) puts these keys in formData:
//   federalAGI, ssSubtraction, standardDeduction, exemptions,
//   taxableIncome, bracketTax, surtax, calEITC, rentersCredit
//
// FTB 540 line mapping:
//   Line 13 = Federal AGI (from federal Form 1040, line 11b)
//   Line 14 = CA adjustments – subtractions (includes SS)
//   Line 11 = Total exemption amount (personal + dependents)
//   Line 18 = Standard deduction or itemized deductions
//   Line 19 = Taxable income
//   Line 31 = Tax (from tax table or Tax Rate Schedule)
//   Line 62 = Behavioral Health Services Tax (Mental Health surtax)
//   Line 75 = California Earned Income Tax Credit (CalEITC)
//   Line 46 = Nonrefundable Renter's Credit

import type { FieldMap } from './types';
import { centsToDollars } from './types';

export const ftb540FieldMap: FieldMap = {
  // ── Federal AGI → FTB 540 Line 13 ──
  federalAGI: {
    pdfFieldName: '540_form_2019',
    type: 'text',
    transform: centsToDollars,
  },

  // ── CA Subtractions (includes SS subtraction) → FTB 540 Line 14 ──
  ssSubtraction: {
    pdfFieldName: '540_form_2020',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Standard Deduction → FTB 540 Line 18 ──
  standardDeduction: {
    pdfFieldName: '540_form_2024',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Total Exemptions → FTB 540 Line 11 ──
  exemptions: {
    pdfFieldName: '540_form_2017',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Taxable Income → FTB 540 Line 19 ──
  taxableIncome: {
    pdfFieldName: '540_form_2025',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Tax (from brackets) → FTB 540 Line 31 ──
  bracketTax: {
    pdfFieldName: '540_form_2030',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Behavioral Health Services Tax (Mental Health surtax) → FTB 540 Line 62 ──
  surtax: {
    pdfFieldName: '540_form_3008',
    type: 'text',
    transform: centsToDollars,
  },

  // ── CalEITC → FTB 540 Line 75 ──
  calEITC: {
    pdfFieldName: '540_form_3015',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Nonrefundable Renter's Credit → FTB 540 Line 46 ──
  rentersCredit: {
    pdfFieldName: '540_form_3004',
    type: 'text',
    transform: centsToDollars,
  },
};

// Field map for NY IT-201 (Resident Income Tax Return) — 2025
// Maps engine field names from the NY state module's formData to real AcroForm field names.
//
// AcroForm field names extracted from the 2025 NY DTF it201_fill_in.pdf template.
// Unlike IRS forms, the IT-201 uses simple human-readable field names like "Line1", "Line2".
//
// The NY engine (new-york.ts) puts these keys in formData:
//   federalAGI, ssSubtraction, pensionExclusion, box14Subtraction, ny529Deduction,
//   standardDeduction, taxableIncome, nysTax, nycTax,
//   stateEITC, nycEITC, childCredit, nycSchoolTaxCredit, nyChildcareCredit, locality
//
// IT-201 line mapping:
//   Line 1 = Wages, salaries, tips (from federal)
//   Line 17 = Federal AGI (key starting point for NY)
//   Line 24 = NY subtraction modifications (includes SS)
//   Line 31 = Standard deduction or itemized
//   Line 33 = NY taxable income
//   Line 39 = NY state tax
//   Line 47 = NYC taxable income (same as NYS for residents)
//   Line 47a = NYC tax
//   Line 65 = NY state EITC (line 65 in the credits section)
//   Line 63 = NY child credit
//
// NOTE: The NY engine already converts cents to dollars in its formData output.
// Actually — looking at new-york.ts, formData stores RAW CENTS values.
// So we DO need the centsToDollars transform here.

import type { FieldMap } from './types';
import { centsToDollars } from './types';

export const it201FieldMap: FieldMap = {
  // ── Federal AGI → IT-201 Line 17 ──
  federalAGI: {
    pdfFieldName: 'Line17',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NY Modifications ──
  // Social Security subtraction is part of NY subtractions
  ssSubtraction: {
    pdfFieldName: 'Line27',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Standard Deduction → IT-201 Line 34 ──
  standardDeduction: {
    pdfFieldName: 'Line34',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NY Taxable Income → IT-201 Line 37 ──
  taxableIncome: {
    pdfFieldName: 'Line37',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NY State Tax → IT-201 Line 39 ──
  nysTax: {
    pdfFieldName: 'Line39',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NYC Tax → IT-201 Line 47a ──
  nycTax: {
    pdfFieldName: 'Line47a',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NY EITC → IT-201 Line 65 ──
  stateEITC: {
    pdfFieldName: 'Line65',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NY Child Credit → IT-201 Line 63 ──
  childCredit: {
    pdfFieldName: 'Line63',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NYC EITC → IT-201 Line 66a ──
  nycEITC: {
    pdfFieldName: 'Line66a',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NYC School Tax Credit → IT-201 Line 69a ──
  nycSchoolTaxCredit: {
    pdfFieldName: 'Line69a',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NY Childcare Credit → IT-201 Line 62 ──
  nyChildcareCredit: {
    pdfFieldName: 'Line62',
    type: 'text',
    transform: centsToDollars,
  },

  // ── NYC Locality ──
  // The IT-201 has NYC indicator fields: F1_NYC, F2_NYC
  // If locality is 'NYC', we check the NYC residency fields
  locality: {
    pdfFieldName: 'F1_NYC',
    type: 'text',
  },
};

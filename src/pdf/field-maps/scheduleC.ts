// Field map for Schedule C (Profit or Loss From Business) — 2025
// Maps engine field names from mapScheduleC() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040sc.pdf template.
// Uses "topmostSubform[0].Page1[0]." prefix for page 1.
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;

export const scheduleCFieldMap: FieldMap = {
  // ── Header ──
  // f1_1 = Name of proprietor
  // f1_2 = Social security number
  // f1_3 = Principal business or profession
  // f1_4 = Business code (in BComb) — Line B
  businessCode: { pdfFieldName: p1('BComb[0].f1_4[0]'), type: 'text' },
  // f1_5 = Business name — Line C
  businessName: { pdfFieldName: p1('f1_5[0]'), type: 'text' },
  // f1_6 = EIN (in DComb) — Line D
  // f1_7 = Business address — Line E
  // f1_8 = City, state, ZIP

  // ── Part I: Income ──
  // f1_10 = Line 1 (gross receipts or sales)
  grossReceipts: { pdfFieldName: p1('f1_10[0]'), type: 'text' },
  // f1_11 = Line 2 (returns and allowances)
  // f1_12 = Line 3 (subtract line 2 from 1)
  // f1_13 = Line 4 (cost of goods sold from Part III)
  costOfGoodsSold: { pdfFieldName: p1('f1_13[0]'), type: 'text' },
  // f1_14 = Line 5 (gross profit)
  grossIncome: { pdfFieldName: p1('f1_14[0]'), type: 'text' },
  // f1_15 = Line 6 (other income)
  otherIncome: { pdfFieldName: p1('f1_15[0]'), type: 'text' },
  // f1_16 = Line 7 (gross income)

  // ── Part II: Expenses ──
  // Lines 8-27 are the expense lines. They're in the "Lines8-17" and "Lines18-27" subforms.
  // f1_17 = Line 8 (advertising)
  advertising: { pdfFieldName: p1('Lines8-17[0].f1_17[0]'), type: 'text' },
  // f1_18 = Line 9 (car and truck expenses)
  carAndTruck: { pdfFieldName: p1('Lines8-17[0].f1_18[0]'), type: 'text' },
  // f1_19 = Line 10 (commissions and fees)
  commissions: { pdfFieldName: p1('Lines8-17[0].f1_19[0]'), type: 'text' },
  // f1_20 = Line 11 (contract labor)
  // f1_21 = Line 12 (depletion)
  // f1_22 = Line 13 (depreciation)
  // f1_23 = Line 14 (employee benefit programs)
  // f1_24 = Line 15 (insurance other than health)
  insurance: { pdfFieldName: p1('Lines8-17[0].f1_24[0]'), type: 'text' },
  // f1_25 = Line 16a (interest on mortgage)
  // f1_26 = Line 16b (interest, other)
  // f1_27 = Line 17 (legal and professional services)
  legalAndProfessional: { pdfFieldName: p1('Lines8-17[0].f1_27[0]'), type: 'text' },

  // Lines 18-27 in the second subform
  // f1_28 = Line 18 (office expense)
  officeExpenses: { pdfFieldName: p1('Lines18-27[0].f1_28[0]'), type: 'text' },
  // f1_29 = Line 19 (pension and profit-sharing)
  // f1_30 = Line 20a (rent/lease: vehicles)
  // f1_31 = Line 20b (rent/lease: other)
  // f1_32 = Line 21 (repairs and maintenance)
  // f1_33 = Line 22 (supplies)
  supplies: { pdfFieldName: p1('Lines18-27[0].f1_33[0]'), type: 'text' },
  // f1_34 = Line 23 (taxes and licenses)
  // f1_35 = Line 24a (travel)
  // f1_36 = Line 24b (deductible meals)
  // f1_37 = Line 25 (utilities)
  utilities: { pdfFieldName: p1('Lines18-27[0].f1_37[0]'), type: 'text' },
  // f1_38 = Line 26 (wages)
  // f1_40 = Line 27a (other expenses from line 48)
  otherExpenses: { pdfFieldName: p1('Lines18-27[0].f1_40[0]'), type: 'text' },
  // f1_39 = Line 27b
  // f1_41 = Line 28 (total expenses)
  totalExpenses: { pdfFieldName: p1('f1_41[0]'), type: 'text' },

  // ── Results ──
  // f1_42 = Line 29 (tentative profit or loss)
  // f1_43 = Line 30 (home office deduction — in Line30_ReadOrder)
  homeOfficeDeduction: { pdfFieldName: p1('Line30_ReadOrder[0].f1_43[0]'), type: 'text' },
  // f1_44 = Line 30 amount (in Line30_ReadOrder)
  // f1_45 = Line 31 (net profit or loss)
  netProfit: { pdfFieldName: p1('f1_45[0]'), type: 'text' },
};

// Field map for MA Form 1 (Massachusetts Resident Income Tax Return) — 2025
// Maps engine field names from the MA state module's formData to real AcroForm field names.
//
// AcroForm field names extracted from the 2025 MA Form 1 fill-in template.
// Massachusetts uses descriptive human-readable field names.
//
// The MA engine (massachusetts.ts) puts these keys in formData:
//   federalAGI, ssSubtraction, exemptions, otherIncome,
//   stcg, ordinaryTax, stcgTax, stateSurtax, stateEITC
//
// MA Form 1 line mapping:
//   Line a  = Total federal income from U.S. Form 1040, line 9  (federalAGI)
//   Line 11a = Amount paid to Social Security/Medicare/retirement (ssSubtraction)
//   Line 2g = Total exemptions (exemptions)
//   Line 9  = Other income from Schedule X (otherIncome)
//   Line 23b = 12% Income From Schedule B — short-term capital gains (stcg)
//   Line 22 = Tax on 5.0% income (ordinaryTax)
//   Line 23 = Total Tax on Income From Schedule B — includes STCG tax (stcgTax)
//   Line 28b = 4% Surtax (stateSurtax)
//   Line 43 = Earned Income Credit (stateEITC)

import type { FieldMap } from './types';
import { centsToDollars } from './types';

export const maForm1FieldMap: FieldMap = {
  // ── Federal AGI → MA Form 1 Line a ──
  federalAGI: {
    pdfFieldName: 'a Total federal income from U.S. Form 1040, line 9',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Social Security / Retirement Subtraction → MA Form 1 Line 11a ──
  ssSubtraction: {
    pdfFieldName: 'line 11a. Amount you paid to Social Security, Medicare, Railroad, U.S. or Massachusetts retirement. Not more than $2,000',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Total Exemptions → MA Form 1 Line 2g ──
  exemptions: {
    pdfFieldName: 'line 2g. Total exemptions. Add lines 2a through 2f. Enter here and on line 18',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Other Income (Schedule X) → MA Form 1 Line 9 ──
  otherIncome: {
    pdfFieldName: 'line 9. Other income from Schedule X, line 7. Enclose Schedule X; not less than 0',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Short-Term Capital Gains (12% income) → MA Form 1 Line 23b ──
  stcg: {
    pdfFieldName: 'line 23b.  12% Income From Schedule B (see instructions). Not less than 0. Enclose Schedule B',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Tax on 5.0% Income → MA Form 1 Line 22 ──
  ordinaryTax: {
    pdfFieldName: 'line 22. Tax On 5.0% Income (from tax table). If line 21 is more than $24,000, multiply by .05',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Total Tax on Schedule B Income (STCG tax) → MA Form 1 Line 23 ──
  stcgTax: {
    pdfFieldName: 'line 23. Total Tax On Income From Schedule B. Add lines 23a and 23b',
    type: 'text',
    transform: centsToDollars,
  },

  // ── 4% Surtax (Millionaire Tax) → MA Form 1 Line 28b ──
  stateSurtax: {
    pdfFieldName: 'line 28b. 4% Surtax (from Schedule 4% Surtax, line 7). See instructions',
    type: 'text',
    transform: centsToDollars,
  },

  // ── Earned Income Credit → MA Form 1 Line 43 ──
  stateEITC: {
    pdfFieldName: 'line 43. line 43b multiplied by percentage in line 43c',
    type: 'text',
    transform: centsToDollars,
  },
};

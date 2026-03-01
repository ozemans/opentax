// Field map for Schedule D (Capital Gains and Losses) — 2025
// Maps engine field names from mapScheduleD() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040sd.pdf template.
// Uses "topmostSubform[0].Page1[0]." prefix.
//
// Part I: Short-Term Capital Gains and Losses (lines 1a–7)
// Part II: Long-Term Capital Gains and Losses (lines 8a–15)
// Part III: Summary (lines 16–21) — on page 2
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

import type { FieldMap } from './types';

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;
const p2 = (name: string) => `topmostSubform[0].Page2[0].${name}`;

export const scheduleDFieldMap: FieldMap = {
  // f1_1 = Name, f1_2 = SSN
  // c1_1[0], c1_1[1] = checkboxes

  // ── Part I: Short-Term ──
  // Line 2: Form 8949, Part I totals (all ST categories A+B+C)
  // Row2 fields confirmed from 2025 IRS f1040sd.pdf:
  //   f1_11=(d)proceeds, f1_12=(e)basis, f1_13=(g)adjustments, f1_14=(h)gain/loss
  line2Proceeds:     { pdfFieldName: p1('Table_PartI[0].Row2[0].f1_11[0]'), type: 'text' },
  line2Basis:        { pdfFieldName: p1('Table_PartI[0].Row2[0].f1_12[0]'), type: 'text' },
  line2Adjustments:  { pdfFieldName: p1('Table_PartI[0].Row2[0].f1_13[0]'), type: 'text' },
  line2GainLoss:     { pdfFieldName: p1('Table_PartI[0].Row2[0].f1_14[0]'), type: 'text' },

  // Line 5: Net ST capital loss carryover (from prior year Capital Loss Carryover Worksheet)
  // Standalone scalar fields after Part I table rows: f1_19=L4, f1_20=L5, f1_21=L6, f1_22=L7
  line5STCarryforward: { pdfFieldName: p1('f1_20[0]'), type: 'text' },

  // Line 7 = Net short-term capital gain or (loss)
  shortTermGainLoss: { pdfFieldName: p1('f1_22[0]'), type: 'text' },  // Line 7

  // ── Part II: Long-Term ──
  // Line 9: Form 8949, Part II totals (all LT categories D+E+F)
  // Row9 fields confirmed from 2025 IRS f1040sd.pdf:
  //   f1_31=(d)proceeds, f1_32=(e)basis, f1_33=(g)adjustments, f1_34=(h)gain/loss
  line9Proceeds:     { pdfFieldName: p1('Table_PartII[0].Row9[0].f1_31[0]'), type: 'text' },
  line9Basis:        { pdfFieldName: p1('Table_PartII[0].Row9[0].f1_32[0]'), type: 'text' },
  line9Adjustments:  { pdfFieldName: p1('Table_PartII[0].Row9[0].f1_33[0]'), type: 'text' },
  line9GainLoss:     { pdfFieldName: p1('Table_PartII[0].Row9[0].f1_34[0]'), type: 'text' },

  // Line 12: Net LT capital loss carryover (from prior year Capital Loss Carryover Worksheet)
  // Standalone scalar fields after Part II table rows: f1_39=L11, f1_40=L12, f1_41=L13, f1_42=L15
  line12LTCarryforward: { pdfFieldName: p1('f1_40[0]'), type: 'text' },

  // Line 15 = Net long-term capital gain or (loss)
  longTermGainLoss: { pdfFieldName: p1('f1_42[0]'), type: 'text' },  // Line 15

  // ── Part III: Summary (Page 2) ──
  // f2_1 = Line 16 (combine lines 7 and 15)
  netGainLoss: { pdfFieldName: p2('f2_1[0]'), type: 'text' },  // Line 16

  // f2_2 = Line 17 (beneficial amount) — only if both parts are gains
  // f2_3 = Line 18

  // Line 21 = Deductible capital loss (max $3,000 or $1,500 if MFS)
  // f2_4 = Line 21
  deductibleLoss: { pdfFieldName: p2('f2_4[0]'), type: 'text' },  // Line 21

  // Capital loss carryforward is not directly on Schedule D
  // (it's tracked internally for next year), but we map it anyway
  // It would typically appear on a carryover worksheet, not a specific line here
};

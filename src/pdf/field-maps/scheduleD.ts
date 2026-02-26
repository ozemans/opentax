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
  // Table_PartI has rows for lines 1a, 1b, 2, 3
  // Each row has 4 columns: (d) proceeds, (e) cost basis, (g) adjustments, (h) gain/loss
  // But our engine just has the net short-term total.
  // Line 7 = Net short-term capital gain or (loss)
  // f1_22 = Line 7 (the last field before Part II starts)
  shortTermGainLoss: { pdfFieldName: p1('f1_22[0]'), type: 'text' },  // Line 7

  // ── Part II: Long-Term ──
  // Table_PartII has rows for lines 8a, 8b, 9, 10
  // Line 15 = Net long-term capital gain or (loss)
  // f1_42 = Line 15
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

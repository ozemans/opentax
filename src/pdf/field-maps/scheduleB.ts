// Field map for Schedule B (Interest and Ordinary Dividends) — 2025
// Maps engine field names from mapScheduleB() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040sb.pdf template.
// Uses "topmostSubform[0].Page1[0]." prefix (single page form).
//
// Part I: Interest — 14 payer rows + totals
// Part II: Ordinary Dividends — 14 payer rows + totals
// Part III: Foreign Accounts and Trusts — checkboxes/text (not mapped)
//
// Field layout:
//   f1_01 = Name, f1_02 = SSN
//   f1_03/f1_04 = Interest row 1 (payer/amount) — f1_03 in Line1_ReadOrder
//   f1_05/f1_06 = Interest row 2 ...
//   Continues in pairs through interest row 14
//   f1_31 = Line 2 (subtotal interest)
//   f1_32 = Line 3 (excludable interest)
//   f1_33 = Line 4 (total interest) — in ReadOrderControl
//   f1_34 through f1_61 = Dividend rows (payer/amount pairs)
//   f1_62 = Line 5 (subtotal dividends)
//   f1_63 = Line 6 (total dividends)
//
// NOTE: forms.ts already converts cents to dollars. No transform needed here.

const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;

// Build interest payer/amount field mappings
// Interest rows start at f1_03 (in Line1_ReadOrder) and f1_04,
// then f1_05/f1_06 through f1_30 (14 rows x 2 fields = 28 fields)
const interestFields: Record<string, [string, string]> = {
  '1':  ['Line1_ReadOrder[0].f1_03[0]', 'f1_04[0]'],
  '2':  ['f1_05[0]', 'f1_06[0]'],
  '3':  ['f1_07[0]', 'f1_08[0]'],
  '4':  ['f1_09[0]', 'f1_10[0]'],
  '5':  ['f1_11[0]', 'f1_12[0]'],
  '6':  ['f1_13[0]', 'f1_14[0]'],
  '7':  ['f1_15[0]', 'f1_16[0]'],
  '8':  ['f1_17[0]', 'f1_18[0]'],
  '9':  ['f1_19[0]', 'f1_20[0]'],
  '10': ['f1_21[0]', 'f1_22[0]'],
  '11': ['f1_23[0]', 'f1_24[0]'],
  '12': ['f1_25[0]', 'f1_26[0]'],
  '13': ['f1_27[0]', 'f1_28[0]'],
  '14': ['f1_29[0]', 'f1_30[0]'],
};

// Build dividend payer/amount field mappings
// Dividend rows start at f1_34/f1_35 through f1_60/f1_61 (14 rows)
// NOTE: f1_34 is inside ReadOrderControl[0], the rest are at the normal level
const dividendFields: Record<string, [string, string]> = {};
let dFieldNum = 34;
for (let i = 1; i <= 14; i++) {
  const payerNum = String(dFieldNum).padStart(2, '0');
  const amountNum = String(dFieldNum + 1).padStart(2, '0');
  // First dividend payer field is nested in ReadOrderControl
  const payerField = i === 1
    ? `ReadOrderControl[0].f1_${payerNum}[0]`
    : `f1_${payerNum}[0]`;
  dividendFields[String(i)] = [payerField, `f1_${amountNum}[0]`];
  dFieldNum += 2;
}

// Generate dynamic fields for up to 14 payers
const dynamicFields: Record<string, { pdfFieldName: string; type: 'text' }> = {};

for (const [idx, [payerField, amountField]] of Object.entries(interestFields)) {
  dynamicFields[`interest_payer_${idx}`] = {
    pdfFieldName: p1(payerField),
    type: 'text',
  };
  dynamicFields[`interest_amount_${idx}`] = {
    pdfFieldName: p1(amountField),
    type: 'text',
  };
}

for (const [idx, [payerField, amountField]] of Object.entries(dividendFields)) {
  dynamicFields[`dividend_payer_${idx}`] = {
    pdfFieldName: p1(payerField),
    type: 'text',
  };
  dynamicFields[`dividend_amount_${idx}`] = {
    pdfFieldName: p1(amountField),
    type: 'text',
  };
}

export const scheduleBFieldMap = {
  // Totals
  totalInterest:  { pdfFieldName: p1('f1_31[0]'), type: 'text' as const },  // Line 2 subtotal
  totalDividends: { pdfFieldName: p1('f1_62[0]'), type: 'text' as const },  // Line 5 subtotal
  ...dynamicFields,
} satisfies Record<string, { pdfFieldName: string; type: 'text' }>;

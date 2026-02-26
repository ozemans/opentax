// Field map for Form 1040 (U.S. Individual Income Tax Return) — 2025
// Maps engine field names from mapForm1040() to real IRS AcroForm field names.
//
// AcroForm field names extracted from the 2025 IRS f1040.pdf template.
// Page 1 fields: "topmostSubform[0].Page1[0].*"
// Page 2 fields: "topmostSubform[0].Page2[0].*"
//
// FIELD ORDER (Page 1):
//   f1_01-f1_02 = Header year fields
//   f1_03       = Header "20__" (maxLen=2)
//   c1_1-c1_2   = Filed pursuant / Combat zone checkboxes
//   f1_04       = Deceased date text
//   c1_3        = Deceased checkbox
//   f1_05-f1_10 = Deceased/Spouse date fields (split: MM, DD, YYYY)
//   c1_4        = "Other" checkbox at top
//   f1_11       = Your first name and middle initial
//   f1_12       = Your last name
//   f1_13       = If joint return, spouse's first name and MI
//   f1_14       = Spouse last name
//   f1_15       = (checkbox-related? or address-related)
//   f1_16       = Your social security number (maxLen=9)
//   f1_17       = Spouse first name MI (or continuation)
//   f1_18       = Spouse last name (or continuation)
//   f1_19       = Spouse's social security number (maxLen=9)
//   f1_20-f1_27 = Address fields (in Address_ReadOrder)
//   c1_5        = Filing Status: Single
//   c1_6        = Filing Status: MFJ
//   c1_7        = Filing Status: MFS
//   Checkbox_ReadOrder c1_8[0-2], f1_28 = MFS details
//   c1_8[0-1]   = more filing status
//   f1_29        = HOH/QSS qualifying person name
//   c1_9        = Filing Status: HOH (or QSS)
//   f1_30        = QSS qualifying person name
//   c1_10[0-1]  = Digital Assets Yes/No
//   c1_11        = Dependents section header
//   f1_31-f1_46 = Dependent rows (4 rows x 4 fields)
//   Dependent checkboxes: c1_12 through c1_31
//   c1_32       = MFS/HOH lived apart checkbox
//   f1_47       = Line 1a (wages)
//   ... continuing through income section
//
// NOTE: forms.ts already converts all monetary values from cents to dollars
// via toDollars(), so no centsToDollars transform is needed here.

import type { FieldMap } from './types';

// Shorthand helpers for the deeply nested field name prefixes
const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;
const p1Addr = (name: string) => `topmostSubform[0].Page1[0].Address_ReadOrder[0].${name}`;
const p1Dep = (row: string, name: string) => `topmostSubform[0].Page1[0].Table_Dependents[0].${row}.${name}`;
const p1DepChk = (row: string, dep: string, name: string) =>
  `topmostSubform[0].Page1[0].Table_Dependents[0].${row}.${dep}.${name}`;
const p2 = (name: string) => `topmostSubform[0].Page2[0].${name}`;

export const f1040FieldMap: FieldMap = {
  // ── Personal info (Page 1) ──
  // f1_11 = Your first name and middle initial
  // f1_12 = Your last name
  // f1_16 = Your SSN (maxLen=9)
  firstName:      { pdfFieldName: p1('f1_11[0]'), type: 'text' },
  lastName:       { pdfFieldName: p1('f1_12[0]'), type: 'text' },
  ssn:            { pdfFieldName: p1('f1_16[0]'), type: 'text' },

  // ── Filing Status checkboxes ──
  // c1_5 = Single
  // c1_6 = MFJ
  // c1_7 = MFS
  // c1_9 = HOH (based on form layout, after MFS section)
  // Note: QSS checkbox position - based on the form, c1_10[0] or another position.
  // From the extraction: c1_8[0] and c1_8[1] appear after the MFS area as HOH/QSS.
  // Looking at the visual form: after MFS there's HOH, then QSS.
  // c1_5 = Single, c1_6 = MFJ, c1_7 = MFS
  // Then Checkbox_ReadOrder has MFS sub-items
  // After that: c1_8[0] at field position 39 and c1_8[1] at 40 (outside Checkbox_ReadOrder)
  // These likely correspond to HOH and QSS.
  filingStatusSingle: { pdfFieldName: p1('c1_5[0]'), type: 'checkbox' },
  filingStatusMFJ:    { pdfFieldName: p1('c1_6[0]'), type: 'checkbox' },
  filingStatusMFS:    { pdfFieldName: p1('c1_7[0]'), type: 'checkbox' },
  filingStatusHoH:    { pdfFieldName: p1('c1_8[0]'), type: 'checkbox' },
  filingStatusQSS:    { pdfFieldName: p1('c1_9[0]'), type: 'checkbox' },

  // ── Spouse info ──
  // f1_13 = Spouse first name and MI
  // f1_14 = Spouse last name
  // f1_19 = Spouse SSN (maxLen=9)
  spouseFirstName: { pdfFieldName: p1('f1_13[0]'), type: 'text' },
  spouseLastName:  { pdfFieldName: p1('f1_14[0]'), type: 'text' },
  spouseSSN:       { pdfFieldName: p1('f1_19[0]'), type: 'text' },

  // ── Address ──
  // In Address_ReadOrder subform:
  // f1_20 = Home address (street)
  // f1_21 = Apt. no.
  // f1_22 = City, town or post office
  // f1_23 = State
  // f1_24 = ZIP code
  // f1_25 = Foreign country name
  // f1_26 = Foreign province/state/county
  // f1_27 = Foreign postal code
  address: { pdfFieldName: p1Addr('f1_20[0]'), type: 'text' },
  city:    { pdfFieldName: p1Addr('f1_22[0]'), type: 'text' },
  state:   { pdfFieldName: p1Addr('f1_23[0]'), type: 'text' },
  zip:     { pdfFieldName: p1Addr('f1_24[0]'), type: 'text' },

  // ── Dependents (up to 4 rows) ──
  // Row1: f1_31 = name, f1_32 = SSN, f1_33 = relationship, f1_34 = (4th column)
  // Row2: f1_35 = name, f1_36 = SSN, f1_37 = relationship, f1_38 = (4th column)
  // Row3: f1_39 = name (maxLen=9), f1_40 = SSN, f1_41 = relationship, f1_42 = (4th column)
  // Row4: f1_43 = name, f1_44 = SSN, f1_45 = relationship, f1_46 = (4th column)
  // Note: Row3 fields have maxLen=9 which is unusual for names — but they still work.
  // Row7 checkboxes: Dependent1.c1_28[0] = CTC, c1_28[1] = credit for other dependents
  dependent1_name:         { pdfFieldName: p1Dep('Row1[0]', 'f1_31[0]'), type: 'text' },
  dependent1_ssn:          { pdfFieldName: p1Dep('Row1[0]', 'f1_32[0]'), type: 'text' },
  dependent1_relationship: { pdfFieldName: p1Dep('Row1[0]', 'f1_33[0]'), type: 'text' },
  dependent1_ctc:          { pdfFieldName: p1DepChk('Row7[0]', 'Dependent1[0]', 'c1_28[0]'), type: 'checkbox' },
  dependent2_name:         { pdfFieldName: p1Dep('Row2[0]', 'f1_35[0]'), type: 'text' },
  dependent2_ssn:          { pdfFieldName: p1Dep('Row2[0]', 'f1_36[0]'), type: 'text' },
  dependent2_relationship: { pdfFieldName: p1Dep('Row2[0]', 'f1_37[0]'), type: 'text' },
  dependent2_ctc:          { pdfFieldName: p1DepChk('Row7[0]', 'Dependent2[0]', 'c1_29[0]'), type: 'checkbox' },
  dependent3_name:         { pdfFieldName: p1Dep('Row3[0]', 'f1_39[0]'), type: 'text' },
  dependent3_ssn:          { pdfFieldName: p1Dep('Row3[0]', 'f1_40[0]'), type: 'text' },
  dependent3_relationship: { pdfFieldName: p1Dep('Row3[0]', 'f1_41[0]'), type: 'text' },
  dependent3_ctc:          { pdfFieldName: p1DepChk('Row7[0]', 'Dependent3[0]', 'c1_30[0]'), type: 'checkbox' },
  dependent4_name:         { pdfFieldName: p1Dep('Row4[0]', 'f1_43[0]'), type: 'text' },
  dependent4_ssn:          { pdfFieldName: p1Dep('Row4[0]', 'f1_44[0]'), type: 'text' },
  dependent4_relationship: { pdfFieldName: p1Dep('Row4[0]', 'f1_45[0]'), type: 'text' },
  dependent4_ctc:          { pdfFieldName: p1DepChk('Row7[0]', 'Dependent4[0]', 'c1_31[0]'), type: 'checkbox' },

  // ── Income Section (Page 1) ──
  // f1_47 = Line 1a (wages from W-2 Box 1)
  line1:  { pdfFieldName: p1('f1_47[0]'), type: 'text' },

  // Lines 2a/2b: Interest
  // Looking at the form: Line 2a (tax-exempt interest) and Line 2b (taxable interest)
  // The fields between 1z and 3a are: f1_56 = 1z, f1_57 = 2a, f1_58 = 2b
  line2b: { pdfFieldName: p1('f1_58[0]'), type: 'text' },

  // Lines 3a/3b: Dividends
  // f1_59 = 3a (qualified dividends), f1_60 = 3b (ordinary dividends)
  line3a: { pdfFieldName: p1('f1_59[0]'), type: 'text' },
  line3b: { pdfFieldName: p1('f1_60[0]'), type: 'text' },

  // Lines 4-6: IRA/pensions/SS distributions
  // f1_61 = Line 4a (IRA distributions)
  // Then checkboxes c1_33, c1_34
  // f1_62 = Line 4b (taxable amount)
  // f1_63 = Line 5a (pensions and annuities)
  // c1_35-c1_37 = checkboxes for line 5
  // f1_64 = Line 5b (taxable amount)
  // f1_65 = Line 6a (social security benefits)
  // f1_66 = Line 6b (taxable amount)
  // c1_38-c1_40 = checkboxes for line 6

  // Line 7a: Capital gain or (loss)
  // f1_67 = Line 7a
  line7:  { pdfFieldName: p1('f1_67[0]'), type: 'text' },

  // f1_68 = Line 7b? (child's capital gain inclusion)
  // f1_69 = something else

  // Line 8: Additional income from Schedule 1, line 10
  // f1_73 is far down. Let me count:
  // After line 7: f1_67 = 7a, f1_68 = ?, f1_69 = ?
  // c1_41, c1_42 = checkboxes (Schedule D not required / child's CG)
  // f1_70 = Line 8 (additional income from Schedule 1)
  line8:  { pdfFieldName: p1('f1_70[0]'), type: 'text' },

  // c1_43, c1_44 = more checkboxes
  // f1_71 = Line 9 (total income: add lines 1z, 2b, 3b, 4b, 5b, 6b, 7a, and 8)
  line9:  { pdfFieldName: p1('f1_71[0]'), type: 'text' },

  // f1_72 = Line 10 (adjustments to income from Schedule 1, line 26)
  // f1_73 = ?
  // f1_74 = ?
  // f1_75 = Line 11a (AGI, last line on page 1)

  // Actually: after line 9 (f1_71), there's line 10 and line 11a.
  // f1_72 = Line 10 (adjustments from Schedule 1)
  // f1_73 = Line 11a (AGI = line 9 minus line 10)
  // But wait, there are 75 total text fields on page 1, with f1_75 being the last.
  // Let me re-examine: f1_71 = 9, f1_72 = 10, f1_73 = 11a

  line11: { pdfFieldName: p1('f1_73[0]'), type: 'text' },

  // ── Page 2 fields ──
  // f2_01 = Line 11b (AGI repeat at top of page 2)
  // c2_1 through c2_8 = Line 12a-12d checkboxes
  // f2_02 = Line 12e (standard deduction or itemized deductions amount)
  line12: { pdfFieldName: p2('f2_02[0]'), type: 'text' },

  // f2_03 = Line 13a (QBI deduction)
  line13: { pdfFieldName: p2('f2_03[0]'), type: 'text' },

  // f2_04 = Line 13b (additional deductions from Schedule 1-A)
  // f2_05 = Line 14 (add lines 12e, 13a, and 13b)
  line14: { pdfFieldName: p2('f2_05[0]'), type: 'text' },

  // f2_06 = Line 15 (taxable income = line 11b minus line 14, if zero or less enter -0-)
  line15: { pdfFieldName: p2('f2_06[0]'), type: 'text' },

  // c2_9, c2_10, c2_11 = Line 16 checkboxes (8814, 4972, other)
  // f2_07 = Line 16 (tax)
  line16: { pdfFieldName: p2('f2_07[0]'), type: 'text' },

  // f2_08 = Line 17 (amount from Schedule 2, line 3)
  line17: { pdfFieldName: p2('f2_08[0]'), type: 'text' },

  // f2_09 = Line 18 (add lines 16 and 17)
  // f2_10 = Line 19 (child tax credit or credit for other dependents from 8812)
  line19: { pdfFieldName: p2('f2_10[0]'), type: 'text' },

  // f2_11 = Line 20 (amount from Schedule 3, line 8)
  // f2_12 = Line 21 (add lines 19 and 20)
  // f2_13 = Line 22 (subtract line 21 from line 18)
  // f2_14 = Line 23 (other taxes from Schedule 2, line 21)
  line23: { pdfFieldName: p2('f2_14[0]'), type: 'text' },

  // f2_15 = Line 24 (total tax = add lines 22 and 23)
  line24: { pdfFieldName: p2('f2_15[0]'), type: 'text' },

  // Lines 25a-25d: Federal income tax withheld
  // f2_16 = Line 25a (from Form(s) W-2)
  // f2_17 = Line 25b (from Form(s) 1099)
  // f2_18 = Line 25c (other forms)
  // f2_19 = Line 25d (total = add lines 25a through 25c)
  line25: { pdfFieldName: p2('f2_19[0]'), type: 'text' },

  // f2_20 = Line 26 (estimated tax payments)
  line26: { pdfFieldName: p2('f2_20[0]'), type: 'text' },

  // f2_21 = Line 26 extra text? (estimated payments with former spouse)
  // SSN_ReadOrder -> f2_22 = SSN at top of page 2
  // f2_23 = Line 27a (earned income credit)
  line27: { pdfFieldName: p2('f2_23[0]'), type: 'text' },

  // c2_12, c2_13 = Line 27b/27c checkboxes
  // c2_14 in Line28_ReadOrder = Line 28 checkbox
  // f2_24 = Line 28 (additional child tax credit from 8812)
  line28: { pdfFieldName: p2('f2_24[0]'), type: 'text' },

  // f2_25 = Line 29 (American opportunity credit from 8863)
  // f2_26 = Line 30 (refundable adoption credit from 8839)
  // f2_27 = Line 31 (amount from Schedule 3, line 15)
  // f2_28 = Line 32 (total other payments and refundable credits: add 27a, 28-31)
  // f2_29 = Line 33 (total payments: add 25d, 26, and 32)
  line33: { pdfFieldName: p2('f2_29[0]'), type: 'text' },

  // c2_15 = Line 34 checkbox?
  // f2_30 = Line 34 (if line 33 > line 24, overpayment)
  line34: { pdfFieldName: p2('f2_30[0]'), type: 'text' },

  // f2_31 = Line 35a (amount of line 34 you want refunded)
  line35a: { pdfFieldName: p2('f2_31[0]'), type: 'text' },

  // Direct deposit:
  // f2_32 in RoutingNo = routing number
  routingNumber: { pdfFieldName: p2('RoutingNo[0].f2_32[0]'), type: 'text' },
  // c2_16[0] = Checking, c2_16[1] = Savings
  accountType: { pdfFieldName: p2('c2_16[0]'), type: 'checkbox' },
  // f2_33 in AccountNo = account number
  accountNumber: { pdfFieldName: p2('AccountNo[0].f2_33[0]'), type: 'text' },

  // f2_34 = Line 36 (amount of line 34 applied to next year's estimated tax)
  // f2_35 = Line 37 (amount you owe = subtract line 33 from line 24)
  line37: { pdfFieldName: p2('f2_35[0]'), type: 'text' },

  // Informational fields (effectiveTaxRate, marginalTaxRate are intentionally NOT mapped
  // since they don't appear on the actual IRS form)
};

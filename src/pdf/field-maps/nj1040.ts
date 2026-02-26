// Field map for NJ-1040 (New Jersey Resident Income Tax Return) — 2025
// Maps engine field names from the NJ state module's formData to real AcroForm field names.
//
// IMPORTANT: The NJ-1040 PDF uses individual digit fields (MaxLen=1) for all
// monetary amounts. Each dollar value is entered digit-by-digit across multiple
// form fields. This means standard single-field mapping does NOT work for
// monetary values on this form.
//
// The NJ engine (new-jersey.ts) puts these keys in formData:
//   njGrossIncome, exemptions, propertyTaxDeduction, propertyCreditUsed,
//   taxableIncome, taxBeforeCredits, stateEITC
//
// NJ-1040 line mapping (for reference — digit-by-digit filling needed):
//   Line 15 = NJ Gross Income
//   Line 27 = Exemptions
//   Line 38a = Property Tax Deduction (18% of rent paid)
//   Line 29 = NJ Taxable Income
//   Line 36 = Tax (from rate table)
//   Line 37 = Property Tax Credit Used
//   Line 55 = NJ Earned Income Tax Credit
//
// TODO: Implement digit-by-digit filling for NJ-1040 monetary fields.
// For now, this field map is intentionally empty because all monetary PDF
// fields have MaxLen=1 and require splitting values into individual digits.

import type { FieldMap } from './types';

export const nj1040FieldMap: FieldMap = {
  // All NJ-1040 monetary fields use individual digit entry (MaxLen=1).
  // Standard single-field mapping cannot be used for dollar amounts.
  // A future enhancement should add digit-by-digit filling support.
};

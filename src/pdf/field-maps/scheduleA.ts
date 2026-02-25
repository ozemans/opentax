// Field map for Schedule A (Itemized Deductions)
// Maps engine field names from the scheduleA mapping to placeholder PDF field names.

import type { FieldMap } from './types';

export const scheduleAFieldMap: FieldMap = {
  line1: { pdfFieldName: 'schA_line1', type: 'text' },    // Medical expenses
  line4: { pdfFieldName: 'schA_line4', type: 'text' },    // Medical after AGI threshold
  line5d: { pdfFieldName: 'schA_line5d', type: 'text' },  // SALT (capped)
  line8a: { pdfFieldName: 'schA_line8a', type: 'text' },  // Mortgage interest
  line11: { pdfFieldName: 'schA_line11', type: 'text' },   // Charitable cash
  line12: { pdfFieldName: 'schA_line12', type: 'text' },   // Charitable non-cash
  line17: { pdfFieldName: 'schA_line17', type: 'text' },   // Total itemized deductions
};

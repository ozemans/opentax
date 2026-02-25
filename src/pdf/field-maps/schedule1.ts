// Field map for Schedule 1 (Additional Income and Adjustments to Income)
// Maps engine field names from mapSchedule1() to placeholder PDF field names.

import type { FieldMap } from './types';

export const schedule1FieldMap: FieldMap = {
  // Part I: Additional Income
  line3: { pdfFieldName: 'sch1_line3', type: 'text' },   // Business income
  line4: { pdfFieldName: 'sch1_line4', type: 'text' },   // Capital gain/loss
  line7: { pdfFieldName: 'sch1_line7', type: 'text' },   // Unemployment
  line10: { pdfFieldName: 'sch1_line10', type: 'text' },  // Other income
  line11: { pdfFieldName: 'sch1_line11', type: 'text' },  // Educator expenses

  // Part II: Adjustments
  line15: { pdfFieldName: 'sch1_line15', type: 'text' },  // Half of SE tax
  line17: { pdfFieldName: 'sch1_line17', type: 'text' },  // HSA deduction
  line20: { pdfFieldName: 'sch1_line20', type: 'text' },  // IRA deduction
  line21: { pdfFieldName: 'sch1_line21', type: 'text' },  // Student loan interest
};

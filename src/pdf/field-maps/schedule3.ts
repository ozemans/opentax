// Field map for Schedule 3 (Additional Credits and Payments)
// Maps engine field names from the schedule3 mapping to placeholder PDF field names.

import type { FieldMap } from './types';

export const schedule3FieldMap: FieldMap = {
  line2: { pdfFieldName: 'sch3_line2', type: 'text' },  // Child care credit
  line3: { pdfFieldName: 'sch3_line3', type: 'text' },  // Education credits
  line4: { pdfFieldName: 'sch3_line4', type: 'text' },  // Saver's credit
};

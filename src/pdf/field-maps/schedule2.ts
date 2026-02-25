// Field map for Schedule 2 (Additional Taxes)
// Maps engine field names from the schedule2 mapping to placeholder PDF field names.

import type { FieldMap } from './types';

export const schedule2FieldMap: FieldMap = {
  line1: { pdfFieldName: 'sch2_line1', type: 'text' },    // AMT
  line6: { pdfFieldName: 'sch2_line6', type: 'text' },    // SE tax
  line11: { pdfFieldName: 'sch2_line11', type: 'text' },   // Additional Medicare Tax
  line12: { pdfFieldName: 'sch2_line12', type: 'text' },   // NIIT
  line21: { pdfFieldName: 'sch2_line21', type: 'text' },   // Total additional taxes
};

// Field map for Schedule D (Capital Gains and Losses)
// Maps engine field names from mapScheduleD() to placeholder PDF field names.

import type { FieldMap } from './types';

export const scheduleDFieldMap: FieldMap = {
  shortTermGainLoss: { pdfFieldName: 'schD_shortTermGainLoss', type: 'text' },
  longTermGainLoss: { pdfFieldName: 'schD_longTermGainLoss', type: 'text' },
  netGainLoss: { pdfFieldName: 'schD_netGainLoss', type: 'text' },
  deductibleLoss: { pdfFieldName: 'schD_deductibleLoss', type: 'text' },
  carryforward: { pdfFieldName: 'schD_carryforward', type: 'text' },
};

// Field map for Schedule SE (Self-Employment Tax)
// Maps engine field names from mapScheduleSE() to placeholder PDF field names.

import type { FieldMap } from './types';

export const scheduleSEFieldMap: FieldMap = {
  netEarnings: { pdfFieldName: 'schSE_netEarnings', type: 'text' },
  socialSecurityTax: { pdfFieldName: 'schSE_socialSecurityTax', type: 'text' },
  medicareTax: { pdfFieldName: 'schSE_medicareTax', type: 'text' },
  totalSETax: { pdfFieldName: 'schSE_totalSETax', type: 'text' },
  deductibleHalf: { pdfFieldName: 'schSE_deductibleHalf', type: 'text' },
};

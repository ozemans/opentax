// Field map for Schedule B (Interest and Ordinary Dividends)
// Maps engine field names from mapScheduleB() to placeholder PDF field names.
// Dynamic fields (interest_payer_N, dividend_payer_N) are handled generically.

import type { FieldMap } from './types';

// Base static fields
const baseFields: FieldMap = {
  totalInterest: { pdfFieldName: 'schB_totalInterest', type: 'text' },
  totalDividends: { pdfFieldName: 'schB_totalDividends', type: 'text' },
};

// Generate dynamic fields for up to 20 payers
const dynamicFields: FieldMap = {};
for (let i = 1; i <= 20; i++) {
  dynamicFields[`interest_payer_${i}`] = {
    pdfFieldName: `schB_interest_payer_${i}`,
    type: 'text',
  };
  dynamicFields[`interest_amount_${i}`] = {
    pdfFieldName: `schB_interest_amount_${i}`,
    type: 'text',
  };
  dynamicFields[`dividend_payer_${i}`] = {
    pdfFieldName: `schB_dividend_payer_${i}`,
    type: 'text',
  };
  dynamicFields[`dividend_amount_${i}`] = {
    pdfFieldName: `schB_dividend_amount_${i}`,
    type: 'text',
  };
}

export const scheduleBFieldMap: FieldMap = {
  ...baseFields,
  ...dynamicFields,
};

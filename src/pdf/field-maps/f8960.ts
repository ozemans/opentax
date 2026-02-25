// Field map for Form 8960 (Net Investment Income Tax)
// Maps engine field names from mapForm8960() to placeholder PDF field names.

import type { FieldMap } from './types';

export const f8960FieldMap: FieldMap = {
  interestIncome: { pdfFieldName: 'f8960_interestIncome', type: 'text' },
  dividendIncome: { pdfFieldName: 'f8960_dividendIncome', type: 'text' },
  capitalGainsIncome: { pdfFieldName: 'f8960_capitalGainsIncome', type: 'text' },
  totalInvestmentIncome: { pdfFieldName: 'f8960_totalInvestmentIncome', type: 'text' },
  magi: { pdfFieldName: 'f8960_magi', type: 'text' },
  niitAmount: { pdfFieldName: 'f8960_niitAmount', type: 'text' },
};

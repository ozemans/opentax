// Field map for Schedule C (Profit or Loss From Business)
// Maps engine field names from mapScheduleC() to placeholder PDF field names.

import type { FieldMap } from './types';

export const scheduleCFieldMap: FieldMap = {
  // Header
  businessName: { pdfFieldName: 'schC_businessName', type: 'text' },
  businessCode: { pdfFieldName: 'schC_businessCode', type: 'text' },

  // Income
  grossReceipts: { pdfFieldName: 'schC_grossReceipts', type: 'text' },
  costOfGoodsSold: { pdfFieldName: 'schC_costOfGoodsSold', type: 'text' },
  grossIncome: { pdfFieldName: 'schC_grossIncome', type: 'text' },
  otherIncome: { pdfFieldName: 'schC_otherIncome', type: 'text' },

  // Expenses
  advertising: { pdfFieldName: 'schC_advertising', type: 'text' },
  carAndTruck: { pdfFieldName: 'schC_carAndTruck', type: 'text' },
  commissions: { pdfFieldName: 'schC_commissions', type: 'text' },
  insurance: { pdfFieldName: 'schC_insurance', type: 'text' },
  legalAndProfessional: { pdfFieldName: 'schC_legalAndProfessional', type: 'text' },
  officeExpenses: { pdfFieldName: 'schC_officeExpenses', type: 'text' },
  supplies: { pdfFieldName: 'schC_supplies', type: 'text' },
  utilities: { pdfFieldName: 'schC_utilities', type: 'text' },
  otherExpenses: { pdfFieldName: 'schC_otherExpenses', type: 'text' },
  totalExpenses: { pdfFieldName: 'schC_totalExpenses', type: 'text' },

  // Results
  netProfit: { pdfFieldName: 'schC_netProfit', type: 'text' },
  homeOfficeDeduction: { pdfFieldName: 'schC_homeOfficeDeduction', type: 'text' },
};

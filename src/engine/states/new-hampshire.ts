// New Hampshire State Tax Module
//
// NH's Interest and Dividends (I&D) tax was repealed effective January 1, 2025.
// For tax year 2025, the rate is 0%. The state still technically has the tax
// framework (hasIncomeTax: true) but the rate is 0%.
//
// Only interest and dividends were ever taxable under this tax.
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';

export const newHampshire: StateModule = {
  stateCode: 'NH',
  stateName: 'New Hampshire',
  hasIncomeTax: true, // Tax framework exists, rate is 0% in 2025

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    // Only interest and dividends are subject to NH I&D tax
    const idIncome = input.taxableInterest + input.ordinaryDividends;
    const rate = config.flatRate ?? 0;
    const taxableIncome = Math.max(0, idIncome);

    // Rate is 0% for 2025 (repealed), so tax is always $0
    const tax = Math.round(taxableIncome * rate);

    const effectiveRate = 0;

    return {
      stateCode: 'NH',
      stateName: 'New Hampshire',
      hasIncomeTax: true,
      stateAGI: idIncome,
      stateAdditions: 0,
      stateSubtractions: 0,
      stateDeduction: 0,
      stateExemptions: 0,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: tax,
      stateCredits: 0,
      stateSurtax: 0,
      localTax: 0,
      stateTaxAfterCredits: tax,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed: input.stateWithheld + input.stateEstimatedPayments - tax,
      effectiveRate,
      marginalRate: rate * 100,
      creditBreakdown: {},
      formData: {
        interestIncome: input.taxableInterest,
        dividendIncome: input.ordinaryDividends,
        totalIDIncome: idIncome,
        taxRate: rate,
        tax,
      },
      formId: config.formId,
    };
  },
};

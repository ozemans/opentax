// North Carolina State Tax Module
//
// NC uses a flat 4.50% rate for 2025.
// Starting point: federal AGI.
// Key features:
// - Standard deduction: $12,750 single / $25,500 MFJ
// - No personal exemptions
// - Social Security income is taxable (not exempt)
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import { computeFlatTax, computeStateStandardDeduction } from './common';

export const northCarolina: StateModule = {
  stateCode: 'NC',
  stateName: 'North Carolina',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const rate = config.flatRate ?? 0.045;

    let ncAGI = input.federalAGI;
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    ncAGI -= ssSubtraction;

    const deduction = computeStateStandardDeduction(input.filingStatus, config);
    const taxableIncome = Math.max(0, ncAGI - deduction);

    const taxBeforeCredits = computeFlatTax(taxableIncome, rate);
    const taxAfterCredits = taxBeforeCredits;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    return {
      stateCode: 'NC',
      stateName: 'North Carolina',
      hasIncomeTax: true,
      stateAGI: ncAGI,
      stateAdditions: 0,
      stateSubtractions: ssSubtraction,
      stateDeduction: deduction,
      stateExemptions: 0,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits,
      stateCredits: 0,
      stateSurtax: 0,
      localTax: 0,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed: input.stateWithheld + input.stateEstimatedPayments - taxAfterCredits,
      effectiveRate,
      marginalRate: rate * 100,
      creditBreakdown: {},
      formData: {
        federalAGI: input.federalAGI,
        ncAGI,
        deduction,
        taxableIncome,
        taxRate: rate,
        taxBeforeCredits,
      },
      formId: config.formId,
    };
  },
};

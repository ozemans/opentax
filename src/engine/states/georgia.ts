// Georgia State Tax Module
//
// GA uses a flat 5.49% rate for 2025 (enacted via HB 1437).
// Starting point: federal AGI.
// Key features:
// - Standard deduction: $12,000 single / $24,000 MFJ
// - No personal exemptions
// - Social Security income is NOT exempt (taxable)
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import { computeFlatTax, computeStateStandardDeduction } from './common';

export const georgia: StateModule = {
  stateCode: 'GA',
  stateName: 'Georgia',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const rate = config.flatRate ?? 0.0549;

    // Georgia AGI starts from federal AGI
    let gaAGI = input.federalAGI;

    // Subtract SS if exempt (not exempt for GA per config)
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    gaAGI -= ssSubtraction;

    // Standard deduction
    const deduction = computeStateStandardDeduction(input.filingStatus, config);
    const taxableIncome = Math.max(0, gaAGI - deduction);

    const taxBeforeCredits = computeFlatTax(taxableIncome, rate);
    const taxAfterCredits = taxBeforeCredits;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    return {
      stateCode: 'GA',
      stateName: 'Georgia',
      hasIncomeTax: true,
      stateAGI: gaAGI,
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
        gaAGI,
        deduction,
        taxableIncome,
        taxRate: rate,
        taxBeforeCredits,
      },
      formId: config.formId,
    };
  },
};

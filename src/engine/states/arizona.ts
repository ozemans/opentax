// Arizona State Tax Module
//
// AZ uses a flat 2.50% rate (enacted via Prop 208 / SB 1828).
// Starting point: federal AGI.
// Key features:
// - Standard deduction mirrors federal: $14,600 single / $29,200 MFJ
// - Social Security is fully exempt
// - No personal exemptions (standard deduction only)
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import { computeFlatTax, computeStateStandardDeduction } from './common';

export const arizona: StateModule = {
  stateCode: 'AZ',
  stateName: 'Arizona',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const rate = config.flatRate ?? 0.025;

    let azAGI = input.federalAGI;
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    azAGI -= ssSubtraction;

    const deduction = computeStateStandardDeduction(input.filingStatus, config);
    const taxableIncome = Math.max(0, azAGI - deduction);

    const taxBeforeCredits = computeFlatTax(taxableIncome, rate);
    const taxAfterCredits = taxBeforeCredits;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    return {
      stateCode: 'AZ',
      stateName: 'Arizona',
      hasIncomeTax: true,
      stateAGI: azAGI,
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
        azAGI,
        deduction,
        taxableIncome,
        taxRate: rate,
        taxBeforeCredits,
      },
      formId: config.formId,
    };
  },
};

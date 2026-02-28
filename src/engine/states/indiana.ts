// Indiana State Tax Module
//
// IN uses a flat 3.05% rate for 2025 (reduced from 3.15%).
// Starting point: federal AGI.
// Key features:
// - Personal exemptions: $1,000 per person (filer, spouse for MFJ, each dependent)
// - Social Security income is fully exempt
// - County income tax varies by county (not included — requires additional input)
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import { computeFlatTax, computePersonalExemptions } from './common';

export const indiana: StateModule = {
  stateCode: 'IN',
  stateName: 'Indiana',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const rate = config.flatRate ?? 0.0305;

    let inAGI = input.federalAGI;

    // Subtract Social Security (exempt in Indiana)
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    inAGI -= ssSubtraction;

    // Personal exemptions
    const exemptions = computePersonalExemptions(input, config);
    const taxableIncome = Math.max(0, inAGI - exemptions);

    const taxBeforeCredits = computeFlatTax(taxableIncome, rate);
    const taxAfterCredits = taxBeforeCredits;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    return {
      stateCode: 'IN',
      stateName: 'Indiana',
      hasIncomeTax: true,
      stateAGI: inAGI,
      stateAdditions: 0,
      stateSubtractions: ssSubtraction,
      stateDeduction: 0,
      stateExemptions: exemptions,
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
        inAGI,
        exemptions,
        taxableIncome,
        taxRate: rate,
        taxBeforeCredits,
      },
      formId: config.formId,
    };
  },
};

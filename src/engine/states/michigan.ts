// Michigan State Tax Module
//
// MI uses a flat 4.25% rate.
// Starting point: federal AGI.
// Key features:
// - Personal exemptions instead of standard deduction: $5,600 per person (2025)
// - Social Security income is fully exempt
// - No standard deduction (exemptions only)
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import { computeFlatTax, computePersonalExemptions } from './common';

export const michigan: StateModule = {
  stateCode: 'MI',
  stateName: 'Michigan',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const rate = config.flatRate ?? 0.0425;

    let miAGI = input.federalAGI;

    // Subtract Social Security (exempt in Michigan)
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    miAGI -= ssSubtraction;

    // Personal exemptions reduce taxable income
    const exemptions = computePersonalExemptions(input, config);
    const taxableIncome = Math.max(0, miAGI - exemptions);

    const taxBeforeCredits = computeFlatTax(taxableIncome, rate);
    const taxAfterCredits = taxBeforeCredits;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    return {
      stateCode: 'MI',
      stateName: 'Michigan',
      hasIncomeTax: true,
      stateAGI: miAGI,
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
        miAGI,
        exemptions,
        taxableIncome,
        taxRate: rate,
        taxBeforeCredits,
      },
      formId: config.formId,
    };
  },
};

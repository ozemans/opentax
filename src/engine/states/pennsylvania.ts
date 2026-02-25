// Pennsylvania State Tax Module
//
// PA uses its own income computation — 8 classes of income taxed at a flat 3.07%.
// Key exemptions: Social Security and retirement income are fully exempt.
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import { computeFlatTax } from './common';

/**
 * Compute Pennsylvania taxable income by summing PA income classes.
 * PA does not start from federal AGI — it computes its own base.
 *
 * PA income classes (simplified):
 * 1. Compensation (wages, salaries)
 * 2. Interest
 * 3. Dividends
 * 4. Net gains from business (self-employment)
 * 5. Net gains from property (capital gains)
 * 6. Other income (unemployment, etc.)
 *
 * Excluded: Social Security, retirement distributions
 */
function computePATaxableIncome(input: StateTaxInput): number {
  let income = 0;

  // Class 1: Compensation (wages)
  income += input.wages;

  // Class 2: Interest
  income += input.taxableInterest;

  // Class 3: Dividends
  income += input.ordinaryDividends;

  // Class 4: Net business income (self-employment)
  income += Math.max(0, input.selfEmploymentIncome);

  // Class 5: Net gains from property (capital gains — both ST and LT)
  if (input.netCapitalGainLoss > 0) {
    income += input.netCapitalGainLoss;
  }

  // Class 6: Other income (includes unemployment, excludes SS and retirement)
  income += input.unemployment;
  income += input.otherIncome;

  // Note: Social Security and retirement distributions are EXEMPT in PA
  // They are intentionally not added.

  return Math.max(0, income);
}

export const pennsylvania: StateModule = {
  stateCode: 'PA',
  stateName: 'Pennsylvania',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const rate = config.flatRate ?? 0.0307;
    const taxableIncome = computePATaxableIncome(input);
    const taxBeforeCredits = computeFlatTax(taxableIncome, rate);
    const taxAfterCredits = taxBeforeCredits; // PA has minimal credits for basic filers
    const totalTax = taxAfterCredits;

    const effectiveRate =
      taxableIncome > 0
        ? Math.round((totalTax / taxableIncome) * 10000) / 100
        : 0;

    return {
      stateCode: 'PA',
      stateName: 'Pennsylvania',
      hasIncomeTax: true,
      stateAGI: taxableIncome,
      stateAdditions: 0,
      stateSubtractions: 0,
      stateDeduction: 0,
      stateExemptions: 0,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits,
      stateCredits: 0,
      stateSurtax: 0,
      localTax: 0,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed:
        input.stateWithheld + input.stateEstimatedPayments - totalTax,
      effectiveRate,
      marginalRate: rate * 100,
      creditBreakdown: {},
      formData: {
        taxableIncome,
        taxRate: rate,
        taxBeforeCredits,
      },
      formId: config.formId,
    };
  },
};

// Illinois State Tax Module
//
// IL uses a flat 4.95% rate starting from federal AGI.
// Key features:
// - Social Security income is exempt
// - Retirement distributions are exempt
// - Personal exemptions: $2,625 per taxpayer, spouse, and dependent
// - State EITC: 20% of federal EITC (refundable)
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import { computeFlatTax, computePersonalExemptions, computeStateEITC } from './common';

/**
 * Compute Illinois taxable income.
 * Starts from federal AGI, then subtracts SS, retirement, and personal exemptions.
 */
function computeILTaxableIncome(
  input: StateTaxInput,
  config: StateConfig,
): { taxableIncome: number; subtractions: number; exemptions: number } {
  // Start from federal AGI
  let income = input.federalAGI;

  // Subtract Social Security (exempt)
  const ssSubtraction = input.socialSecurityIncome;
  income -= ssSubtraction;

  // Subtract retirement distributions (exempt)
  const retirementSubtraction = input.retirementDistributions;
  income -= retirementSubtraction;

  const subtractions = ssSubtraction + retirementSubtraction;

  // Subtract personal exemptions
  const exemptions = computePersonalExemptions(input, config);
  income -= exemptions;

  return {
    taxableIncome: Math.max(0, income),
    subtractions,
    exemptions,
  };
}

export const illinois: StateModule = {
  stateCode: 'IL',
  stateName: 'Illinois',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const rate = config.flatRate ?? 0.0495;
    const { taxableIncome, subtractions, exemptions } = computeILTaxableIncome(input, config);

    const taxBeforeCredits = computeFlatTax(taxableIncome, rate);

    // IL EITC = 20% of federal EITC (refundable)
    const eitcCfg = config.credits?.eitc;
    const eitcPercent = eitcCfg?.type === 'percent_of_federal' ? eitcCfg.percentOfFederal : 0.20;
    const stateEITC = computeStateEITC(input.federalEITC, eitcPercent);

    const creditBreakdown: Record<string, number> = {};
    let totalCredits = 0;
    if (stateEITC > 0) {
      creditBreakdown.eitc = stateEITC;
      totalCredits += stateEITC;
    }

    // EITC is refundable, so it can reduce tax below zero
    const taxAfterCredits = Math.max(0, taxBeforeCredits - totalCredits);
    const refundableCredits = Math.max(0, totalCredits - taxBeforeCredits);

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    return {
      stateCode: 'IL',
      stateName: 'Illinois',
      hasIncomeTax: true,
      stateAGI: input.federalAGI,
      stateAdditions: 0,
      stateSubtractions: subtractions,
      stateDeduction: 0,
      stateExemptions: exemptions,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits,
      stateCredits: totalCredits,
      stateSurtax: 0,
      localTax: 0,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed:
        input.stateWithheld + input.stateEstimatedPayments + refundableCredits - taxAfterCredits,
      effectiveRate,
      marginalRate: rate * 100,
      creditBreakdown,
      formData: {
        federalAGI: input.federalAGI,
        subtractions,
        exemptions,
        taxableIncome,
        taxRate: rate,
        taxBeforeCredits,
        stateEITC,
      },
      formId: config.formId,
    };
  },
};

// Ohio State Tax Module
//
// Ohio uses progressive brackets with a 0% bracket for the first ~$26,050.
// Starting point: federal AGI (Ohio AGI).
// Exemptions are applied as CREDITS, not deductions.
// Exemption credits are income-tiered: $2,400 (AGI <= $40k), $2,150 ($40k-$80k),
// $1,900 ($80k-$750k), $0 (AGI > $750k).
//
// Ohio brackets (2025, approximated from 2024):
//   0% up to $26,050
//   2.75% from $26,050 to $46,100
//   3.50% from $46,100 to $92,150
//   3.75% from $92,150 to $115,300
//   3.99% over $115,300
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket } from '../types';
import {
  computeStateBracketTax,
  getStateMarginalRate,
} from './common';

/**
 * Compute Ohio personal exemption credits.
 * In Ohio, exemptions reduce TAX (as credits), not taxable income.
 * $2,400 per exemption (taxpayer, spouse for MFJ, each dependent).
 */
function computeOHExemptionCredits(
  input: StateTaxInput,
  config: StateConfig,
  ohioAGI: number,
): number {
  if (!config.personalExemption) return 0;

  const pe = config.personalExemption;
  let count = 0;

  // Taxpayer
  count += 1;

  // Spouse (MFJ / QSS)
  if (
    input.filingStatus === 'married_filing_jointly' ||
    input.filingStatus === 'qualifying_surviving_spouse'
  ) {
    count += 1;
  }

  // Dependents
  count += input.numDependents;

  // Use income-tiered amounts if available, otherwise fall back to flat amount
  let perExemption: number;
  if (pe.tiers?.length) {
    perExemption = 0;
    for (const tier of pe.tiers) {
      if (tier.maxAgi === null || ohioAGI <= tier.maxAgi) {
        perExemption = tier.amount;
        break;
      }
    }
  } else {
    perExemption = pe.taxpayer[input.filingStatus] ?? pe.dependent;
  }

  return count * perExemption;
}

export const ohio: StateModule = {
  stateCode: 'OH',
  stateName: 'Ohio',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No OH brackets configured for filing status: ${input.filingStatus}`);
    }

    // Ohio AGI starts from federal AGI
    // Subtract Social Security if exempt
    let ohioAGI = input.federalAGI;
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    ohioAGI -= ssSubtraction;

    const taxableIncome = Math.max(0, ohioAGI);

    // Bracket tax
    const taxBeforeCredits = computeStateBracketTax(taxableIncome, brackets);

    // Ohio exemption credits (reduce tax, not income)
    const exemptionCredits = computeOHExemptionCredits(input, config, ohioAGI);

    const totalCredits = exemptionCredits;
    const taxAfterCredits = Math.max(0, taxBeforeCredits - totalCredits);

    const creditBreakdown: Record<string, number> = {};
    if (exemptionCredits > 0) {
      creditBreakdown.exemptionCredits = exemptionCredits;
    }

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);

    return {
      stateCode: 'OH',
      stateName: 'Ohio',
      hasIncomeTax: true,
      stateAGI: ohioAGI,
      stateAdditions: 0,
      stateSubtractions: ssSubtraction,
      stateDeduction: 0,
      stateExemptions: exemptionCredits, // Stored here for reference, but applied as credit
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits,
      stateCredits: totalCredits,
      stateSurtax: 0,
      localTax: 0,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed:
        input.stateWithheld + input.stateEstimatedPayments - taxAfterCredits,
      effectiveRate,
      marginalRate: marginalRate * 100,
      creditBreakdown,
      formData: {
        federalAGI: input.federalAGI,
        ohioAGI,
        taxableIncome,
        taxBeforeCredits,
        exemptionCredits,
        taxAfterCredits,
      },
      formId: config.formId,
    };
  },
};

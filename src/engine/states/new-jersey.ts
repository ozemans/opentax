// New Jersey State Tax Module
//
// NJ computes its own gross income (own_computation starting point).
// Progressive brackets: 1.4% through 10.75%.
// Personal exemptions: $1,000 taxpayer, $1,000 spouse, $1,500/dependent.
// Property tax: deduction up to $15,000 OR $50 credit (whichever benefits more).
// EITC = 40% of federal EITC (refundable).
// Social Security is exempt.
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket } from '../types';
import {
  computeStateBracketTax,
  getStateMarginalRate,
  computePersonalExemptions,
  computeStateEITC,
} from './common';

// Maximum NJ property tax deduction: $15,000 (1_500_000 cents)
const NJ_PROPERTY_TAX_DEDUCTION_MAX = 1_500_000;

/**
 * Compute NJ gross income.
 * NJ uses its own computation, similar to federal but with NJ-specific rules.
 */
function computeNJGrossIncome(input: StateTaxInput): number {
  let income = 0;

  income += input.wages;
  income += input.taxableInterest;
  income += input.ordinaryDividends;
  income += Math.max(0, input.selfEmploymentIncome);
  income += input.unemployment;
  income += input.retirementDistributions;
  income += input.otherIncome;

  // Capital gains as ordinary income
  if (input.netCapitalGainLoss > 0) {
    income += input.netCapitalGainLoss;
  }

  // Social Security is exempt — intentionally not included

  return Math.max(0, income);
}

export const newJersey: StateModule = {
  stateCode: 'NJ',
  stateName: 'New Jersey',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No NJ brackets configured for filing status: ${input.filingStatus}`);
    }

    const njGrossIncome = computeNJGrossIncome(input);

    // Personal exemptions (deducted from income)
    const exemptions = computePersonalExemptions(input, config);

    // Property tax deduction (up to $15,000) vs credit ($50)
    const propertyTaxDeduction = Math.min(input.propertyTaxes, NJ_PROPERTY_TAX_DEDUCTION_MAX);

    // Compare: deduction benefit vs credit
    // Rough estimate: deduction saves (deduction * marginal rate) vs $50 credit
    // We'll compute both ways and take the better one
    const taxableWithDeduction = Math.max(0, njGrossIncome - exemptions - propertyTaxDeduction);
    const taxableWithoutDeduction = Math.max(0, njGrossIncome - exemptions);

    const taxWithDeduction = computeStateBracketTax(taxableWithDeduction, brackets);
    const taxWithCredit = computeStateBracketTax(taxableWithoutDeduction, brackets);
    const propertyCreditAmount = config.credits?.propertyTax?.maxCredit?.[input.filingStatus] ?? 5_000;
    const taxAfterPropertyCredit = Math.max(0, taxWithCredit - propertyCreditAmount);

    // Use whichever method produces less tax
    let taxBeforeCredits: number;
    let deductionUsed: number;
    let propertyCreditUsed: number;
    let taxableIncome: number;

    if (input.propertyTaxes > 0 && taxWithDeduction <= taxAfterPropertyCredit) {
      // Deduction is better
      taxBeforeCredits = taxWithDeduction;
      deductionUsed = propertyTaxDeduction;
      propertyCreditUsed = 0;
      taxableIncome = taxableWithDeduction;
    } else if (input.propertyTaxes > 0) {
      // Credit is better
      taxBeforeCredits = taxAfterPropertyCredit;
      deductionUsed = 0;
      propertyCreditUsed = Math.min(propertyCreditAmount, taxWithCredit);
      taxableIncome = taxableWithoutDeduction;
    } else {
      // No property tax
      taxBeforeCredits = taxWithCredit;
      deductionUsed = 0;
      propertyCreditUsed = 0;
      taxableIncome = taxableWithoutDeduction;
    }

    // EITC = 40% of federal EITC (refundable)
    const eitcCfg = config.credits?.eitc;
    const eitcPercent = eitcCfg?.type === 'percent_of_federal' ? eitcCfg.percentOfFederal : 0;
    const stateEITC = computeStateEITC(input.federalEITC, eitcPercent);

    const creditBreakdown: Record<string, number> = {};
    let totalCredits = 0;

    if (propertyCreditUsed > 0) {
      creditBreakdown.propertyTaxCredit = propertyCreditUsed;
      totalCredits += propertyCreditUsed;
    }
    if (stateEITC > 0) {
      creditBreakdown.eitc = stateEITC;
      totalCredits += stateEITC;
    }

    const taxAfterCredits = Math.max(0, taxBeforeCredits - stateEITC);
    const refundableCredits = Math.max(0, stateEITC - taxBeforeCredits);

    const effectiveRate =
      njGrossIncome > 0
        ? Math.round((taxAfterCredits / njGrossIncome) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);

    return {
      stateCode: 'NJ',
      stateName: 'New Jersey',
      hasIncomeTax: true,
      stateAGI: njGrossIncome,
      stateAdditions: 0,
      stateSubtractions: 0,
      stateDeduction: deductionUsed,
      stateExemptions: exemptions,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits + propertyCreditUsed, // Pre-credit tax
      stateCredits: totalCredits,
      stateSurtax: 0,
      localTax: 0,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed:
        input.stateWithheld + input.stateEstimatedPayments + refundableCredits - taxAfterCredits,
      effectiveRate,
      marginalRate: marginalRate * 100,
      creditBreakdown,
      formData: {
        njGrossIncome,
        exemptions,
        propertyTaxDeduction: deductionUsed,
        propertyCreditUsed,
        taxableIncome,
        taxBeforeCredits,
        stateEITC,
      },
      formId: config.formId,
    };
  },
};

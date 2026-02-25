// New York State Tax Module
//
// NY tax structure:
// - 9 progressive NYS brackets (4% through 10.9%)
// - Standard deduction
// - NYC local tax if locality === 'NYC' (4 brackets: 3.078%–3.876%)
// - EITC = 30% of federal EITC (refundable)
// - Child credit: $330/child, phases out at income thresholds
// - Social Security is exempt
//
// NYC residents pay BOTH NYS and NYC income tax.
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket, FilingStatus } from '../types';
import {
  computeStateBracketTax,
  getStateMarginalRate,
  computeStateStandardDeduction,
  computeStateEITC,
} from './common';

/**
 * Compute NY child credit.
 * $330 per qualifying child, phases out above AGI threshold.
 */
function computeNYChildCredit(
  numChildren: number,
  agi: number,
  filingStatus: FilingStatus,
  config: StateConfig,
): number {
  if (numChildren <= 0) return 0;
  if (!config.credits?.childCredit) return 0;

  const { amountPerChild, agiPhaseOut } = config.credits.childCredit;
  const threshold = agiPhaseOut[filingStatus] ?? Infinity;

  if (agi > threshold) return 0;

  return numChildren * amountPerChild;
}

export const newYork: StateModule = {
  stateCode: 'NY',
  stateName: 'New York',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No NY brackets configured for filing status: ${input.filingStatus}`);
    }

    // Start from federal AGI
    let income = input.federalAGI;

    // Subtract Social Security (exempt in NY)
    const ssSubtraction = input.socialSecurityIncome;
    income -= ssSubtraction;

    // Standard deduction
    const standardDeduction = computeStateStandardDeduction(input.filingStatus, config);
    income -= standardDeduction;

    const taxableIncome = Math.max(0, income);

    // NYS bracket tax
    const nysTax = computeStateBracketTax(taxableIncome, brackets);

    // NYC local tax (only if locality is 'NYC')
    let nycTax = 0;
    if (input.locality === 'NYC' && config.localTax?.NYC) {
      const nycBrackets = config.localTax.NYC.brackets as TaxBracket[];
      nycTax = computeStateBracketTax(taxableIncome, nycBrackets);
    }

    const taxBeforeCredits = nysTax;

    // Credits
    const creditBreakdown: Record<string, number> = {};
    let totalCredits = 0;

    // NY EITC = 30% of federal EITC (refundable)
    const eitcPercent = config.credits?.eitc?.percentOfFederal ?? 0;
    const stateEITC = computeStateEITC(input.federalEITC, eitcPercent);
    if (stateEITC > 0) {
      creditBreakdown.eitc = stateEITC;
      totalCredits += stateEITC;
    }

    // NY child credit
    const childCredit = computeNYChildCredit(
      input.numQualifyingChildren,
      input.federalAGI,
      input.filingStatus,
      config,
    );
    if (childCredit > 0) {
      creditBreakdown.childCredit = childCredit;
      totalCredits += childCredit;
    }

    // Apply credits against NYS tax (not NYC)
    const nysAfterCredits = Math.max(0, taxBeforeCredits - totalCredits);
    const refundableCredits = Math.max(0, totalCredits - taxBeforeCredits);

    const totalTaxAfterCredits = nysAfterCredits + nycTax;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((totalTaxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);

    return {
      stateCode: 'NY',
      stateName: 'New York',
      hasIncomeTax: true,
      stateAGI: input.federalAGI,
      stateAdditions: 0,
      stateSubtractions: ssSubtraction,
      stateDeduction: standardDeduction,
      stateExemptions: 0,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits,
      stateCredits: totalCredits,
      stateSurtax: 0,
      localTax: nycTax,
      stateTaxAfterCredits: totalTaxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed:
        input.stateWithheld +
        input.stateEstimatedPayments +
        refundableCredits -
        totalTaxAfterCredits,
      effectiveRate,
      marginalRate: marginalRate * 100,
      creditBreakdown,
      formData: {
        federalAGI: input.federalAGI,
        ssSubtraction,
        standardDeduction,
        taxableIncome,
        nysTax,
        nycTax,
        stateEITC,
        childCredit,
        locality: input.locality ?? '',
      },
      formId: config.formId,
    };
  },
};

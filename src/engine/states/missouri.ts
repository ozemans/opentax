// Missouri State Tax Module
//
// MO uses progressive brackets from 0% to 4.95%.
// Starting point: federal AGI.
// Key features:
// - Standard deduction mirrors federal ($15,000 single / $30,000 MFJ for 2025)
// - Social Security income is fully exempt
// - All filing statuses use the same bracket thresholds
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket } from '../types';
import {
  computeStateBracketTax,
  computeStateStandardDeduction,
  getStateMarginalRate,
} from './common';

export const missouri: StateModule = {
  stateCode: 'MO',
  stateName: 'Missouri',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No MO brackets configured for filing status: ${input.filingStatus}`);
    }

    let moAGI = input.federalAGI;

    // Subtract Social Security (exempt in Missouri)
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    moAGI -= ssSubtraction;

    // Standard deduction (mirrors federal)
    const deduction = computeStateStandardDeduction(input.filingStatus, config);
    const taxableIncome = Math.max(0, moAGI - deduction);

    const taxBeforeCredits = computeStateBracketTax(taxableIncome, brackets);
    const taxAfterCredits = taxBeforeCredits;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);

    return {
      stateCode: 'MO',
      stateName: 'Missouri',
      hasIncomeTax: true,
      stateAGI: moAGI,
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
      marginalRate: marginalRate * 100,
      creditBreakdown: {},
      formData: {
        federalAGI: input.federalAGI,
        moAGI,
        deduction,
        taxableIncome,
        taxBeforeCredits,
      },
      formId: config.formId,
    };
  },
};

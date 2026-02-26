// Virginia State Tax Module
//
// Virginia uses progressive brackets (2% / 3% / 5% / 5.75%).
// Starting point: federal AGI.
// Subtractions: Social Security (exempt).
// Deduction: standard deduction.
// Exemptions: personal exemptions ($930 each, + $800 for age 65/blind).
// Credits: VA EITC = 20% of federal EITC (refundable).
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket } from '../types';
import {
  computeStateBracketTax,
  getStateMarginalRate,
  computePersonalExemptions,
  computeStateStandardDeduction,
  computeStateEITC,
} from './common';

export const virginia: StateModule = {
  stateCode: 'VA',
  stateName: 'Virginia',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No VA brackets configured for filing status: ${input.filingStatus}`);
    }

    // Start from federal AGI
    let income = input.federalAGI;

    // Subtract Social Security (exempt in VA)
    const ssSubtraction = input.socialSecurityIncome;
    income -= ssSubtraction;

    const subtractions = ssSubtraction;

    // Standard deduction
    const standardDeduction = computeStateStandardDeduction(input.filingStatus, config);
    income -= standardDeduction;

    // Personal exemptions
    const exemptions = computePersonalExemptions(input, config);
    income -= exemptions;

    const taxableIncome = Math.max(0, income);

    // Bracket tax
    const taxBeforeCredits = computeStateBracketTax(taxableIncome, brackets);

    // VA EITC = 20% of federal EITC (refundable)
    const eitcCfg = config.credits?.eitc;
    const eitcPercent = eitcCfg?.type === 'percent_of_federal' ? eitcCfg.percentOfFederal : 0;
    const stateEITC = computeStateEITC(input.federalEITC, eitcPercent);

    const creditBreakdown: Record<string, number> = {};
    let totalCredits = 0;
    if (stateEITC > 0) {
      creditBreakdown.eitc = stateEITC;
      totalCredits += stateEITC;
    }

    const taxAfterCredits = Math.max(0, taxBeforeCredits - totalCredits);
    const refundableCredits = Math.max(0, totalCredits - taxBeforeCredits);

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);

    return {
      stateCode: 'VA',
      stateName: 'Virginia',
      hasIncomeTax: true,
      stateAGI: input.federalAGI,
      stateAdditions: 0,
      stateSubtractions: subtractions,
      stateDeduction: standardDeduction,
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
      marginalRate: marginalRate * 100,
      creditBreakdown,
      formData: {
        federalAGI: input.federalAGI,
        subtractions,
        standardDeduction,
        exemptions,
        taxableIncome,
        taxBeforeCredits,
        stateEITC,
      },
      formId: config.formId,
    };
  },
};

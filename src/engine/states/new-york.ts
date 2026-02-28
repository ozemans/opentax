// New York State Tax Module
//
// NY tax structure:
// - 9 progressive NYS brackets (4% through 10.9%)
// - Standard deduction
// - NYC local tax if locality === 'NYC' (4 brackets: 3.078%–3.876%)
// - EITC = 30% of federal EITC (refundable)
// - Empire State child credit: $1,000/child under 4, $330/child 4-16, gradual phase-out
// - Social Security is exempt
//
// NYC residents pay BOTH NYS and NYC income tax.
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket } from '../types';
import {
  computeStateBracketTax,
  getStateMarginalRate,
  computeStateStandardDeduction,
  computeStateEITC,
} from './common';

/**
 * Compute NY Empire State child credit.
 * $1,000 per child under 4, $330 per child ages 4-16.
 * Gradual phase-out: $16.50 reduction per $1,000 of AGI over threshold
 * (round up partial $1,000 increments).
 */
function computeNYChildCredit(
  input: StateTaxInput,
  config: StateConfig,
): number {
  if (input.numQualifyingChildren <= 0) return 0;
  if (!config.credits?.childCredit) return 0;

  const { amountPerChild, amountPerChildUnder4, agiPhaseOut } = config.credits.childCredit;
  const threshold = agiPhaseOut[input.filingStatus] ?? Infinity;

  // Under-4 children get higher amount; remaining qualifying children get standard
  const numUnder4 = Math.min(input.numChildrenUnder4 ?? 0, input.numQualifyingChildren);
  const numOlder = input.numQualifyingChildren - numUnder4;

  const under4Amount = amountPerChildUnder4 ?? amountPerChild;
  let totalCredit = (numUnder4 * under4Amount) + (numOlder * amountPerChild);

  // Gradual phase-out: $16.50 per $1,000 over threshold (in cents: 1650 per 100000)
  if (input.federalAGI > threshold) {
    const excess = input.federalAGI - threshold;
    const increments = Math.ceil(excess / 100_000); // Round up partial $1,000
    const reduction = increments * 1650; // $16.50 = 1650 cents per increment
    totalCredit = Math.max(0, totalCredit - reduction);
  }

  return totalCredit;
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

    const isNonResident = input.residencyType === 'nonresident';

    // Non-residents (IT-203): tax applies only to NY-sourced income.
    // If stateWages from NY-coded W-2s are available, use that; otherwise fall back to federalAGI.
    const baseIncome = isNonResident
      ? (input.nySourceIncome != null && input.nySourceIncome > 0
          ? input.nySourceIncome
          : input.federalAGI)
      : input.federalAGI;

    // Social Security exempt in NY — only subtract for residents (non-residents likely have $0 SS)
    const ssSubtraction = isNonResident ? 0 : input.socialSecurityIncome;
    let income = baseIncome - ssSubtraction;

    // Standard deduction
    const standardDeduction = computeStateStandardDeduction(input.filingStatus, config);
    income -= standardDeduction;

    const taxableIncome = Math.max(0, income);

    // NYS bracket tax
    const nysTax = computeStateBracketTax(taxableIncome, brackets);

    // NYC local tax — non-residents do NOT owe NYC resident tax (IT-203 filers only owe NYS tax)
    let nycTax = 0;
    if (!isNonResident && input.locality === 'NYC' && config.localTax?.NYC) {
      const nycBracketsConfig = config.localTax.NYC.brackets;
      const nycBrackets = Array.isArray(nycBracketsConfig)
        ? nycBracketsConfig as TaxBracket[]
        : ((nycBracketsConfig as Partial<Record<string, TaxBracket[]>>)[input.filingStatus]
          ?? (nycBracketsConfig as Partial<Record<string, TaxBracket[]>>)['single']
          ?? []) as TaxBracket[];
      nycTax = computeStateBracketTax(taxableIncome, nycBrackets);
    }

    const taxBeforeCredits = nysTax;

    // Credits
    const creditBreakdown: Record<string, number> = {};
    let totalCredits = 0;

    // NY EITC = 30% of federal EITC (refundable)
    const eitcCfg = config.credits?.eitc;
    const eitcPercent = eitcCfg?.type === 'percent_of_federal' ? eitcCfg.percentOfFederal : 0;
    const stateEITC = computeStateEITC(input.federalEITC, eitcPercent);
    if (stateEITC > 0) {
      creditBreakdown.eitc = stateEITC;
      totalCredits += stateEITC;
    }

    // NY child credit
    const childCredit = computeNYChildCredit(input, config);
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
      stateAGI: baseIncome,
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
        nySourceIncome: baseIncome,
        ssSubtraction,
        standardDeduction,
        taxableIncome,
        nysTax,
        nycTax,
        stateEITC,
        childCredit,
        locality: input.locality ?? '',
        residencyType: input.residencyType ?? 'resident',
      },
      // Non-residents file IT-203; residents file IT-201
      formId: isNonResident ? 'IT-203' : config.formId,
    };
  },
};

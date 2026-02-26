// California State Tax Module
//
// CA tax structure:
// - 10 progressive brackets (1% through 13.3%)
// - Standard deduction: $5,540 single, $11,080 MFJ
// - Personal exemptions: $144 taxpayer, $446/dependent
// - Capital gains taxed as ORDINARY income (no preferential rates)
// - Mental Health Services Tax: 1% surtax on income over $1,000,000
// - CalEITC = independent credit per R&TC §17052.1 (refundable)
// - Renter's credit: $60 single / $120 MFJ if AGI under threshold
// - Social Security is exempt
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
  computeSurtax,
} from './common';

/**
 * Compute CalEITC independently using California's own phase-in/phase-out structure.
 * R&TC §17052.1 — credit rates match federal EITC (7.65%/34%/40%/45% by children).
 */
function computeCalEITCIndependent(
  input: StateTaxInput,
  config: StateConfig,
): number {
  const eitcConfig = config.credits?.eitc;
  if (!eitcConfig || eitcConfig.type !== 'independent') return 0;

  // Earned income = wages + max(0, self-employment income)
  const earnedIncome = input.wages + Math.max(0, input.selfEmploymentIncome);
  if (earnedIncome <= 0) return 0;

  // Investment income disqualification
  const investmentIncome =
    input.taxableInterest + input.ordinaryDividends +
    Math.max(0, input.netCapitalGainLoss);
  if (investmentIncome > eitcConfig.investmentIncomeLimit) return 0;

  // Find the correct tier (3+ children uses tier with children=3)
  const numChildren = Math.min(input.numQualifyingChildren, 3);
  const tier = eitcConfig.tiers.find((t) => t.children === numChildren);
  if (!tier) return 0;

  let credit: number;

  if (earnedIncome <= tier.completedPhaseIn) {
    // Phase-in: credit grows with income
    credit = Math.round(earnedIncome * tier.phaseInRate);
    credit = Math.min(credit, tier.maxCredit);
  } else if (earnedIncome <= tier.phaseOutBegins) {
    // Plateau: max credit
    credit = tier.maxCredit;
  } else if (earnedIncome <= tier.phaseOutEnds) {
    // Phase-out: credit decreases
    const excess = earnedIncome - tier.phaseOutBegins;
    const reduction = Math.round(excess * tier.phaseOutRate);
    credit = Math.max(0, tier.maxCredit - reduction);
  } else {
    credit = 0;
  }

  return credit;
}

/**
 * Compute California renter's credit.
 * Available to renters with AGI below a threshold.
 */
function computeRentersCredit(
  input: StateTaxInput,
  config: StateConfig,
): number {
  if (!input.isRenter || !config.credits?.rentersCredit) return 0;

  const { amount, agiLimit } = config.credits.rentersCredit;
  const limit = agiLimit[input.filingStatus] ?? 0;
  const creditAmount = amount[input.filingStatus] ?? 0;

  if (input.federalAGI > limit) return 0;
  return creditAmount;
}

export const california: StateModule = {
  stateCode: 'CA',
  stateName: 'California',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No CA brackets configured for filing status: ${input.filingStatus}`);
    }

    // Start from federal AGI
    let income = input.federalAGI;

    // Subtract Social Security (exempt in CA)
    const ssSubtraction = input.socialSecurityIncome;
    income -= ssSubtraction;

    // Standard deduction
    const standardDeduction = computeStateStandardDeduction(input.filingStatus, config);
    income -= standardDeduction;

    // Personal exemptions
    const exemptions = computePersonalExemptions(input, config);
    income -= exemptions;

    const taxableIncome = Math.max(0, income);

    // CA treats capital gains as ordinary income — already included in federal AGI,
    // and bracket tax applies to all income uniformly.
    const taxBeforeCredits = computeStateBracketTax(taxableIncome, brackets);

    // Mental Health Services Tax: 1% surtax on income over $1M
    let stateSurtax = 0;
    if (config.surtax) {
      const surtaxIncome = input.federalAGI - ssSubtraction;
      stateSurtax = computeSurtax(surtaxIncome, input.filingStatus, config.surtax);
    }

    const totalTaxBeforeCredits = taxBeforeCredits + stateSurtax;

    // Credits
    const creditBreakdown: Record<string, number> = {};
    let totalCredits = 0;

    // CalEITC — independent computation if available, otherwise percent of federal
    let calEITC = 0;
    const eitcConfig = config.credits?.eitc;
    if (eitcConfig?.type === 'independent') {
      calEITC = computeCalEITCIndependent(input, config);
    } else if (eitcConfig?.type === 'percent_of_federal') {
      calEITC = computeStateEITC(input.federalEITC, eitcConfig.percentOfFederal);
    }
    if (calEITC > 0) {
      creditBreakdown.calEITC = calEITC;
      totalCredits += calEITC;
    }

    // Renter's credit
    const rentersCredit = computeRentersCredit(input, config);
    if (rentersCredit > 0) {
      creditBreakdown.rentersCredit = rentersCredit;
      totalCredits += rentersCredit;
    }

    const taxAfterCredits = Math.max(0, totalTaxBeforeCredits - totalCredits);
    const refundableCredits = Math.max(0, totalCredits - totalTaxBeforeCredits);

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);
    // Add surtax rate if above threshold
    const surtaxIncome = input.federalAGI - ssSubtraction;
    const surtaxApplies =
      config.surtax &&
      surtaxIncome > (config.surtax.threshold[input.filingStatus] ?? Infinity);
    const effectiveMarginal = surtaxApplies
      ? marginalRate + (config.surtax?.rate ?? 0)
      : marginalRate;

    return {
      stateCode: 'CA',
      stateName: 'California',
      hasIncomeTax: true,
      stateAGI: input.federalAGI,
      stateAdditions: 0,
      stateSubtractions: ssSubtraction,
      stateDeduction: standardDeduction,
      stateExemptions: exemptions,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: totalTaxBeforeCredits,
      stateCredits: totalCredits,
      stateSurtax,
      localTax: 0,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed:
        input.stateWithheld +
        input.stateEstimatedPayments +
        refundableCredits -
        taxAfterCredits,
      effectiveRate,
      marginalRate: effectiveMarginal * 100,
      creditBreakdown,
      formData: {
        federalAGI: input.federalAGI,
        ssSubtraction,
        standardDeduction,
        exemptions,
        taxableIncome,
        bracketTax: taxBeforeCredits,
        surtax: stateSurtax,
        calEITC,
        rentersCredit,
      },
      formId: config.formId,
    };
  },
};

// Massachusetts State Tax Module
//
// MA tax structure:
// - 5% flat rate on most income
// - 12% rate on short-term capital gains
// - 4% surtax on income over $1,000,000 ("Millionaire Tax")
// - Personal exemptions: $4,400 single, $8,800 MFJ, $1,000/dependent
// - Social Security is exempt
// - EITC = 40% of federal EITC (refundable)
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import {
  computeFlatTax,
  computePersonalExemptions,
  computeStateEITC,
  computeSurtax,
} from './common';

export const massachusetts: StateModule = {
  stateCode: 'MA',
  stateName: 'Massachusetts',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const ordinaryRate = config.flatRate ?? 0.05;
    const stcgRate = config.shortTermCapGainsRate ?? 0.12;

    // Start from federal AGI
    let income = input.federalAGI;

    // Subtract Social Security (exempt)
    const ssSubtraction = input.socialSecurityIncome;
    income -= ssSubtraction;

    // Personal exemptions
    const exemptions = computePersonalExemptions(input, config);
    income -= exemptions;

    // Separate short-term capital gains from other income
    const stcg = input.shortTermCapitalGains; // Already max(0, ...) from buildStateTaxInput
    const otherIncome = Math.max(0, income - stcg);
    const taxableSTCG = Math.max(0, Math.min(stcg, income)); // Can't exceed total remaining income

    const totalTaxableIncome = Math.max(0, income);

    // Tax on ordinary income at 5%
    const ordinaryTax = computeFlatTax(otherIncome, ordinaryRate);

    // Tax on short-term capital gains at 12%
    const stcgTax = computeFlatTax(taxableSTCG, stcgRate);

    const taxBeforeCredits = ordinaryTax + stcgTax;

    // Surtax: 4% on total income over $1,000,000
    // Note: surtax is on total MA income (before exemptions), not taxable income
    const surtaxIncome = input.federalAGI - ssSubtraction;
    let stateSurtax = 0;
    if (config.surtax) {
      stateSurtax = computeSurtax(surtaxIncome, input.filingStatus, config.surtax);
    }

    const totalTaxBeforeCredits = taxBeforeCredits + stateSurtax;

    // EITC = 40% of federal EITC (refundable)
    const eitcCfg = config.credits?.eitc;
    const eitcPercent = eitcCfg?.type === 'percent_of_federal' ? eitcCfg.percentOfFederal : 0;
    const stateEITC = computeStateEITC(input.federalEITC, eitcPercent);

    const creditBreakdown: Record<string, number> = {};
    let totalCredits = 0;
    if (stateEITC > 0) {
      creditBreakdown.eitc = stateEITC;
      totalCredits += stateEITC;
    }

    const taxAfterCredits = Math.max(0, totalTaxBeforeCredits - totalCredits);
    const refundableCredits = Math.max(0, totalCredits - totalTaxBeforeCredits);

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    // Marginal rate depends on whether next dollar is STCG or ordinary
    // For simplicity, report the ordinary rate as marginal (most common case)
    const marginalRate = surtaxIncome > (config.surtax?.threshold[input.filingStatus] ?? Infinity)
      ? ordinaryRate + (config.surtax?.rate ?? 0)
      : ordinaryRate;

    return {
      stateCode: 'MA',
      stateName: 'Massachusetts',
      hasIncomeTax: true,
      stateAGI: input.federalAGI,
      stateAdditions: 0,
      stateSubtractions: ssSubtraction,
      stateDeduction: 0,
      stateExemptions: exemptions,
      stateTaxableIncome: totalTaxableIncome,
      stateTaxBeforeCredits: totalTaxBeforeCredits,
      stateCredits: totalCredits,
      stateSurtax,
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
        ssSubtraction,
        exemptions,
        otherIncome,
        stcg: taxableSTCG,
        ordinaryTax,
        stcgTax,
        stateSurtax,
        stateEITC,
      },
      formId: config.formId,
    };
  },
};
